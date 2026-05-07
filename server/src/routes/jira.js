const { Router } = require('express')

const router = Router()

const JQL_RE = /\b(AND|OR|NOT|ORDER\s+BY|project|sprint|status|assignee|reporter|priority|issuetype|fixVersion|component|label|created|updated|due)\b|[=!~]/i

function isJql(q) {
  return JQL_RE.test(q.trim())
}

function getConfig() {
  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  const redirectUri = process.env.JIRA_REDIRECT_URI
  return { clientId, clientSecret, redirectUri }
}

function getFrontendOrigin(req) {
  const ref = req.headers.referer || req.headers.referrer
  if (ref) {
    try { return new URL(ref).origin } catch {}
  }
  return `${req.protocol}://${req.get('host')}`
}

// GET /api/jira/auth — redirect to Atlassian OAuth consent
router.get('/auth', (req, res) => {
  const { clientId, redirectUri } = getConfig()
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Jira integration not configured' })
  }
  const origin = getFrontendOrigin(req)
  const state = Buffer.from(JSON.stringify({ origin })).toString('base64')
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'read:jira-work read:jira-user offline_access',
    redirect_uri: redirectUri,
    response_type: 'code',
    prompt: 'consent',
    state,
  })
  res.redirect(`https://auth.atlassian.com/authorize?${params}`)
})

// GET /api/jira/callback — exchange code for tokens, redirect to frontend
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query
  const { clientId, clientSecret, redirectUri } = getConfig()

  let frontendUrl = `${req.protocol}://${req.get('host')}`
  try {
    const decoded = JSON.parse(Buffer.from(state || '', 'base64').toString())
    if (decoded.origin) frontendUrl = decoded.origin
  } catch {}

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
    const { id: cloudId, name: siteName } = resources[0]

    // Get user email
    const meRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    })
    const meData = meRes.ok ? await meRes.json() : {}
    const email = meData.emailAddress || siteName

    const expiresAt = Date.now() + expires_in * 1000

    const params = new URLSearchParams({
      jira_access_token: access_token,
      jira_refresh_token: refresh_token,
      jira_cloud_id: cloudId,
      jira_email: email,
      jira_expires_at: String(expiresAt),
    })
    res.redirect(`${frontendUrl}/?${params}`)
  } catch (err) {
    console.error('Jira callback error:', err)
    res.redirect(`${frontendUrl}/?jira_error=server_error`)
  }
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

// GET /api/jira/issues — search issues (text or JQL)
router.get('/issues', async (req, res) => {
  const { q = '', cloudId } = req.query
  const authHeader = req.headers.authorization
  if (!authHeader || !cloudId) {
    return res.status(400).json({ error: 'authorization header and cloudId required' })
  }
  const accessToken = authHeader.replace('Bearer ', '')

  try {
    let issues
    if (isJql(q)) {
      const jql = q.trim() || 'ORDER BY created DESC'
      const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`
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
      const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/picker?query=${encodeURIComponent(q)}&limit=20`
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
