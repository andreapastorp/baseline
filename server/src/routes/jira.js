const { Router } = require('express')
const crypto = require('crypto')

const router = Router()

// Single-use token handoff, keyed by opaque code
const pendingSessions = new Map()
const SESSION_TTL_MS = 60 * 1000

function stashSession(payload) {
  const code = crypto.randomBytes(24).toString('hex')
  pendingSessions.set(code, { payload, expiresAt: Date.now() + SESSION_TTL_MS })
  setTimeout(() => pendingSessions.delete(code), SESSION_TTL_MS).unref?.()
  return code
}

const JQL_RE = /\b(AND|OR|NOT|ORDER\s+BY|project|sprint|status|assignee|reporter|priority|issuetype|fixVersion|component|label|created|updated|due)\b|[=!~]/i

function isJql(q) {
  return JQL_RE.test(q.trim())
}

function jiraBase(cloudId) {
  return `https://api.atlassian.com/ex/jira/${cloudId}`
}

function getConfig() {
  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  const redirectUri = process.env.JIRA_REDIRECT_URI
  return { clientId, clientSecret, redirectUri }
}

function getFrontendOrigin(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

// GET /api/jira/auth — redirect to Atlassian OAuth consent
router.get('/auth', (req, res) => {
  const { clientId, redirectUri } = getConfig()
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Jira integration not configured' })
  }
  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'offline_access read:jira-work write:jira-work read:jira-user read:project:jira read:board-scope:jira-software read:sprint:jira-software write:sprint:jira-software',
    redirect_uri: redirectUri,
    response_type: 'code',
    prompt: 'consent',
    state,
  })
  res.redirect(`https://auth.atlassian.com/authorize?${params}`)
})

// GET /api/jira/callback — exchange code for tokens, redirect to frontend
router.get('/callback', async (req, res) => {
  const { code, error } = req.query
  const { clientId, clientSecret, redirectUri } = getConfig()

  const frontendUrl = getFrontendOrigin(req)

  if (error) {
    return res.redirect(`${frontendUrl}/?jira_error=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return res.redirect(`${frontendUrl}/?jira_error=no_code`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Jira token exchange failed:', err)
      return res.redirect(`${frontendUrl}/?jira_error=token_exchange_failed`)
    }
    const { access_token, refresh_token, expires_in } = await tokenRes.json()

    // Get accessible resources to find cloudId and email
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    })
    if (!resourcesRes.ok) {
      return res.redirect(`${frontendUrl}/?jira_error=resources_failed`)
    }
    const resources = await resourcesRes.json()
    if (!resources.length) {
      return res.redirect(`${frontendUrl}/?jira_error=no_resources`)
    }
    const { id: cloudId, name: siteName, url: cloudUrl } = resources[0]

    // Get user email
    const meRes = await fetch(`${cloudUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    })
    const meData = meRes.ok ? await meRes.json() : {}
    const email = meData.emailAddress || siteName

    const expiresAt = Date.now() + expires_in * 1000

    const code = stashSession({
      accessToken: access_token,
      refreshToken: refresh_token,
      cloudId,
      cloudUrl: cloudUrl || null,
      email,
      expiresAt,
    })
    res.redirect(`${frontendUrl}/?jira_session=${code}`)
  } catch (err) {
    console.error('Jira callback error:', err)
    res.redirect(`${frontendUrl}/?jira_error=server_error`)
  }
})

// POST /api/jira/session — exchange a one-time code from the callback redirect for tokens
router.post('/session', (req, res) => {
  const { code } = req.body
  const entry = code && pendingSessions.get(code)
  if (!entry) return res.status(404).json({ error: 'Session not found or expired' })
  pendingSessions.delete(code)
  if (Date.now() > entry.expiresAt) return res.status(404).json({ error: 'Session not found or expired' })
  res.json(entry.payload)
})

// POST /api/jira/refresh — refresh access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  const { clientId, clientSecret } = getConfig()
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' })

  try {
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })
    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'refresh_failed' })
    }
    const { access_token, refresh_token, expires_in } = await tokenRes.json()
    res.json({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    })
  } catch (err) {
    console.error('Jira refresh error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/jira/issues — search issues (text or JQL, optionally scoped to a project)
router.get('/issues', async (req, res) => {
  const { q = '', cloudId, projectKey } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId) {
    return res.status(400).json({ error: 'authorization header and cloudId required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  const base = jiraBase(cloudId)

  try {
    let issues
    if (isJql(q)) {
      const jql = q.trim() || 'ORDER BY created DESC'
      const url = `${base}/rest/api/3/search/jql`
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, maxResults: 20, fields: ['summary', 'description'] }),
      })
      if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
      if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
      const data = await r.json()
      issues = (data.issues || []).map(i => ({
        key: i.key,
        title: i.fields.summary,
        desc: extractDesc(i.fields.description),
      }))
    } else if (projectKey) {
      const textClause = q.trim() ? ` AND text ~ ${JSON.stringify(q.trim())}` : ''
      const jql = `project = "${projectKey}"${textClause} ORDER BY updated DESC`
      const url = `${base}/rest/api/3/search/jql`
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, maxResults: 20, fields: ['summary', 'description'] }),
      })
      if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
      if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
      const data = await r.json()
      issues = (data.issues || []).map(i => ({
        key: i.key,
        title: i.fields.summary,
        desc: extractDesc(i.fields.description),
      }))
    } else {
      const url = `${base}/rest/api/3/issue/picker?query=${encodeURIComponent(q)}&limit=20`
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
      if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
      const data = await r.json()
      const sections = data.sections || []
      const allIssues = sections.flatMap(s => s.issues || [])
      issues = allIssues.slice(0, 20).map(i => ({
        key: i.key,
        title: i.summaryText || i.summary,
        desc: '',
      }))
    }
    res.json({ issues })
  } catch (err) {
    console.error('Jira issues error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/jira/fields — fetch custom numeric fields (for story points mapping)
router.get('/fields', async (req, res) => {
  const { cloudId } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId) {
    return res.status(400).json({ error: 'authorization header and cloudId required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')

  try {
    const r = await fetch(`${jiraBase(cloudId)}/rest/api/3/field`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
    const data = await r.json()
    const fields = data
      .filter(f => f.custom && f.schema?.type === 'number')
      .map(f => ({ id: f.id, name: f.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json({ fields })
  } catch (err) {
    console.error('Jira fields error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/jira/sync-points — write story points to a Jira issue field
router.post('/sync-points', async (req, res) => {
  const { cloudId, issueKey, fieldId, points } = req.body
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId || !issueKey || !fieldId || points === undefined) {
    return res.status(400).json({ error: 'authorization header, cloudId, issueKey, fieldId, and points required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  const numericPoints = Number(points)
  if (isNaN(numericPoints)) return res.status(400).json({ error: 'points must be numeric' })

  try {
    const r = await fetch(`${jiraBase(cloudId)}/rest/api/3/issue/${issueKey}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { [fieldId]: numericPoints } }),
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (r.status === 403) return res.status(403).json({ error: 'forbidden' })
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}))
      console.error('Jira sync-points error:', errData)
      return res.status(r.status).json({ error: 'jira_error' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Jira sync-points error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/jira/projects — list accessible projects
router.get('/projects', async (req, res) => {
  const { cloudId } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId) {
    return res.status(400).json({ error: 'authorization header and cloudId required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  try {
    const r = await fetch(`${jiraBase(cloudId)}/rest/api/3/project/search?maxResults=50&orderBy=name`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
    const data = await r.json()
    const projects = (data.values || []).map(p => ({ key: p.key, name: p.name }))
    res.json({ projects })
  } catch (err) {
    console.error('Jira projects error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/jira/sprints — list active + future sprints for a project
router.get('/sprints', async (req, res) => {
  const { cloudId, projectKey } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId || !projectKey) {
    return res.status(400).json({ error: 'authorization header, cloudId, and projectKey required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  const base = jiraBase(cloudId)
  try {
    const boardRes = await fetch(
      `${base}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    )
    if (boardRes.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (!boardRes.ok) return res.json({ sprints: [] })
    const boards = (await boardRes.json()).values || []
    const scrumBoard = boards.find(b => b.type === 'scrum')
    if (!scrumBoard) return res.json({ sprints: [] })

    const sprintRes = await fetch(
      `${base}/rest/agile/1.0/board/${scrumBoard.id}/sprint?state=active,future&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
    )
    if (!sprintRes.ok) return res.json({ sprints: [] })
    const sprints = ((await sprintRes.json()).values || []).map(s => ({ id: s.id, name: s.name, state: s.state }))
    res.json({ sprints })
  } catch (err) {
    console.error('Jira sprints error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/jira/move-to-sprint — assign an issue to a sprint
router.post('/move-to-sprint', async (req, res) => {
  const { cloudId, issueKey, sprintId } = req.body
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId || !issueKey || !sprintId) {
    return res.status(400).json({ error: 'authorization header, cloudId, issueKey, and sprintId required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  try {
    const r = await fetch(`${jiraBase(cloudId)}/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: [issueKey] }),
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (r.status === 403) return res.status(403).json({ error: 'forbidden' })
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}))
      console.error('Jira move-to-sprint error:', errData)
      return res.status(r.status).json({ error: 'jira_error' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Jira move-to-sprint error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// GET /api/jira/statuses — list workflow statuses available in a project
router.get('/statuses', async (req, res) => {
  const { cloudId, projectKey } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId || !projectKey) {
    return res.status(400).json({ error: 'authorization header, cloudId, and projectKey required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  try {
    const r = await fetch(`${jiraBase(cloudId)}/rest/api/3/project/${encodeURIComponent(projectKey)}/statuses`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (!r.ok) return res.status(r.status).json({ error: 'jira_error' })
    const data = await r.json()
    const names = new Set()
    for (const issueType of data || []) {
      for (const status of issueType.statuses || []) names.add(status.name)
    }
    const statuses = [...names].sort().map(name => ({ name }))
    res.json({ statuses })
  } catch (err) {
    console.error('Jira statuses error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/jira/move-to-status — transition an issue to a target status
router.post('/move-to-status', async (req, res) => {
  const { cloudId, issueKey, statusName } = req.body
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId || !issueKey || !statusName) {
    return res.status(400).json({ error: 'authorization header, cloudId, issueKey, and statusName required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')
  const base = jiraBase(cloudId)
  try {
    const transRes = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (transRes.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (!transRes.ok) return res.status(transRes.status).json({ error: 'jira_error' })
    const { transitions } = await transRes.json()
    const match = (transitions || []).find(t => t.to?.name?.toLowerCase() === statusName.toLowerCase())
    if (!match) return res.status(409).json({ error: 'no_valid_transition' })

    const r = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: match.id } }),
    })
    if (r.status === 401) return res.status(401).json({ error: 'unauthorized' })
    if (r.status === 403) return res.status(403).json({ error: 'forbidden' })
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}))
      console.error('Jira move-to-status error:', errData)
      return res.status(r.status).json({ error: 'jira_error' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Jira move-to-status error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

function extractDesc(adf) {
  if (!adf || typeof adf !== 'object') return ''
  const texts = []
  function walk(node) {
    if (!node) return
    if (node.type === 'text' && node.text) texts.push(node.text)
    if (node.content) node.content.forEach(walk)
  }
  walk(adf)
  return texts.join(' ').slice(0, 200)
}

module.exports = router
