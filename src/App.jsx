import { useState, useEffect, useRef } from 'react'

/* ── Count-up animation hook ── */
function useCountUp(target, duration = 650) {
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (target === '–') { setDisplay('–'); return }
    const num = parseFloat(target)
    if (isNaN(num)) { setDisplay(String(target)); return }
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      setDisplay((num * eased).toFixed(1))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return display
}

/* ── Modal a11y: focus trap + Escape + focus restore ── */
function useModalA11y(onClose) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    return () => prev?.focus()
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const focusable = [...el.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [role="checkbox"]:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return ref
}

/* ── Constants ── */
const FIBS = [1, 2, 3, 5, 8, 13, 21, '?']
const AVATAR_COLORS = [
  'oklch(0.52 0.18 250)',
  'oklch(0.50 0.17 160)',
  'oklch(0.62 0.20 50)',
  'oklch(0.52 0.18 295)',
  'oklch(0.52 0.17 185)',
  'oklch(0.58 0.18 20)',
  'oklch(0.54 0.17 220)',
  'oklch(0.54 0.18 135)',
]
function avatarColor(id) {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
const LS_KEY = 'baseline_planning_state'
const LS_KEY_IDENTITY = 'baseline_identity'
const LS_JIRA_KEY = 'baseline_jira_auth'

/* ── API helper ── */
async function api(path, options = {}) {
  const { body, ...rest } = options
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(data.error || res.statusText)
  }
  return res.json()
}

function getWsUrl(roomName, token) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.DEV ? 'localhost:3001' : window.location.host
  return `${proto}//${host}/ws?room=${encodeURIComponent(roomName)}&token=${encodeURIComponent(token)}`
}

/* ── Toggle ── */
function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label || 'Toggle'}
      className="toggle-wrap"
      onClick={() => onChange(!on)}
    >
      <div className={`toggle-track ${on ? 'on' : ''}`}>
        <div className="toggle-thumb" />
      </div>
      {label && <span className="toggle-label" aria-hidden="true">{label}</span>}
    </button>
  )
}

/* ── Participant flip card ── */
function PCard({ voted, value, revealed, delay = 0 }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    if (revealed && voted) {
      const t = setTimeout(() => setFlipped(true), delay)
      return () => clearTimeout(t)
    } else {
      setFlipped(false)
    }
  }, [revealed, voted, delay])
  return (
    <div className="pcard-wrap">
      <div className={`pcard-inner ${flipped ? 'flipped' : ''}`}>
        <div className={`pcard-face pcard-back-face ${voted && !revealed ? 'pcard-voted-check' : ''}`}>
          {voted && !revealed && <span>✓</span>}
        </div>
        <div className="pcard-face pcard-front-face">{value}</div>
      </div>
    </div>
  )
}

/* ── Participants row ── */
function ParticipantsRow({ me, displayParticipants, hasVoted, revealedVotes, revealed }) {
  const voters = displayParticipants.filter(p => p.role === 'voter')
  const votedCount = voters.filter(p => hasVoted.has(p.id)).length
  return (
    <div className="participants">
      <div className="participants-header">
        <span className="label">Participants</span>
        {!revealed
          ? <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{votedCount} / {voters.length} voted</span>
          : <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Votes revealed</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
        {displayParticipants.map((p, i) => {
          const isMe = p.id === me?.id
          const voted = hasVoted.has(p.id)
          const val = revealedVotes[p.id] ?? null
          return (
            <div key={p.id} className="participant-col" style={{ opacity: p.role === 'observer' ? 0.45 : 1 }}>
              {p.role === 'observer'
                ? <div className="pcard-obs-wrap" aria-label={`${p.name} — observer`}><span aria-hidden="true">obs</span></div>
                : <PCard voted={voted} value={val} revealed={revealed} delay={i * 120} />
              }
              <span className={`participant-name ${isMe ? 'is-me' : ''}`}>
                {p.name}{p.isFacilitator ? ' ★' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Story sidebar row ── */
function StoryRow({ story, active, onClick, draggable, onDragStart, onDragOver, onDragEnd, isDragging, showDropBefore }) {
  return (
    <>
      {showDropBefore && <div className="story-drop-indicator" />}
      <button
        className={`story-row ${active ? 'active' : ''} ${story.points !== null ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {draggable && (
          <span className="story-drag-handle" aria-label="Drag to reorder">
            <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
              <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
              <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
              <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
            </svg>
          </span>
        )}
        <span className="story-row-num">{story.num}</span>
        <span className="story-title">{story.title}</span>
        {story.points !== null
          ? <span className="story-pts">{story.points}</span>
          : active
            ? <span className="story-arrow" aria-hidden="true">▶</span>
            : null}
      </button>
    </>
  )
}

function reorderStories(stories, fromIdx, dropIdx) {
  const result = [...stories]
  const [item] = result.splice(fromIdx, 1)
  const insertAt = dropIdx > fromIdx ? dropIdx - 1 : dropIdx
  result.splice(insertAt, 0, item)
  return result
}

/* ── Story sidebar ── */
function StorySidebar({ stories, currentIdx, isFacilitator, onAdd, onJump, onReorder, participants, me }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)

  function handleDragStart(e, i) {
    setDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, i) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    setDropIdx(e.clientY < rect.top + rect.height / 2 ? i : i + 1)
  }

  function handleDrop(e) {
    e.preventDefault()
    if (dragIdx === null || dropIdx === null) { setDragIdx(null); setDropIdx(null); return }
    const reordered = reorderStories(stories, dragIdx, dropIdx)
    onReorder(reordered.map(s => s.id))
    setDragIdx(null)
    setDropIdx(null)
  }

  function handleDragEnd() {
    setDragIdx(null)
    setDropIdx(null)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="label">Stories</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isFacilitator && (
            <button className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add</button>
          )}
        </div>
      </div>
      <div className="sidebar-list" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {stories.map((s, i) => (
          <StoryRow
            key={s.id}
            story={{ ...s, num: i + 1 }}
            active={i === currentIdx}
            onClick={() => onJump && onJump(i)}
            draggable={isFacilitator}
            onDragStart={isFacilitator ? e => handleDragStart(e, i) : undefined}
            onDragOver={isFacilitator ? e => handleDragOver(e, i) : undefined}
            onDragEnd={isFacilitator ? handleDragEnd : undefined}
            isDragging={dragIdx === i}
            showDropBefore={dropIdx === i && dragIdx !== i && dragIdx !== i - 1}
          />
        ))}
        {dropIdx === stories.length && dragIdx !== stories.length - 1 && (
          <div className="story-drop-indicator" />
        )}
      </div>
      <div className="sidebar-room">
        <div className="sidebar-room-header">
          <span className="label">In the Room</span>
        </div>
        <div className="sidebar-room-list">
          {participants.map(p => (
            <div key={p.id} className={`room-participant ${p.role === 'observer' ? 'is-observer' : ''}`}>
              <div className="room-avatar-wrap">
                <div className="room-avatar" style={{ background: avatarColor(p.id) }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div className="room-online-dot" />
              </div>
              <span className="room-name">
                {p.name}{p.isFacilitator ? ' ★' : ''}
              </span>
              {p.role === 'observer' && <span className="room-obs-tag">obs</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Active story card ── */
function ActiveStoryCard({ story, num, total }) {
  const ghost = num < 10 ? `0${num}` : `${num}`
  return (
    <div className="active-story">
      <div className="active-story-ghost" aria-hidden="true">{ghost}</div>
      <div className="active-story-meta">Story {num} of {total}</div>
      <div className="active-story-title">{story.title}</div>
      {story.desc && <div className="active-story-desc">{story.desc}</div>}
    </div>
  )
}

/* ── Voting cards grid ── */
function VotingCards({ selected, onSelect }) {
  return (
    <div className="voting-section">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span className="label">Your Estimate</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.55, letterSpacing: '0.02em' }}>
          1–8 to vote
        </span>
      </div>
      <div className="vote-grid">
        {FIBS.map(v => (
          <button
            key={v}
            className={`vcard ${selected === v ? 'selected' : ''}`}
            onClick={() => onSelect(v)}
            aria-pressed={selected === v}
            aria-label={`Estimate ${v}${typeof v === 'number' ? (v === 1 ? ' point' : ' points') : ''}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Stats after reveal ── */
function RevealStats({ votes, outlierName }) {
  const nums = votes.filter(v => typeof v === 'number')
  const avg  = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '–'
  const min  = nums.length ? Math.min(...nums) : '–'
  const max  = nums.length ? Math.max(...nums) : '–'
  const freq = {}
  nums.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const mode = nums.length ? +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : '–'
  const avgDisplay = useCountUp(avg)
  return (
    <div className="reveal-section">
      <div className="stat-row">
        <div>
          <div className="stat-val primary">{avgDisplay}</div>
          <div className="stat-label">Average</div>
        </div>
        <div>
          <div className="stat-val secondary">{min}–{max}</div>
          <div className="stat-label">Spread</div>
        </div>
        <div>
          <div className="stat-val secondary">{mode}</div>
          <div className="stat-label">Mode</div>
        </div>
      </div>
      {outlierName && (
        <p className="outlier-note">
          <span className="outlier-name">{outlierName}</span> voted differently — discuss before agreeing.
        </p>
      )}
    </div>
  )
}

/* ── Agree score ── */
function AgreeScore({ revealedVotes, existingScore, onAgree }) {
  const allVotes = Object.values(revealedVotes).filter(v => typeof v === 'number')
  const freq = {}
  allVotes.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const sorted = [...new Set(allVotes)].sort((a, b) => a - b)
  const suggested = sorted.length ? sorted.reduce((a, b) => (freq[a] || 0) >= (freq[b] || 0) ? a : b) : null
  const parsedExisting = existingScore != null ? (existingScore === '?' ? '?' : Number(existingScore)) : null
  const [chosen, setChosen] = useState(parsedExisting ?? suggested)
  const sortedSet = new Set(sorted)
  const remaining = FIBS.filter(v => !sortedSet.has(v))
  return (
    <div className="agree-section">
      <span className="label">Set Agreed Score</span>
      <div className="agree-row">
        {sorted.map(v => (
          <button
            key={v}
            className={`vcard-sm ${chosen === v ? 'chosen' : ''}`}
            onClick={() => setChosen(v)}
            aria-pressed={chosen === v}
            aria-label={`Score ${v}`}
          >
            {v}
          </button>
        ))}
        {remaining.length > 0 && (
          <>
            <div className="divider" />
            {remaining.map(v => (
              <button
                key={v}
                className={`vcard-sm ${chosen === v ? 'chosen' : ''}`}
                onClick={() => setChosen(v)}
                aria-pressed={chosen === v}
                aria-label={`Score ${v}`}
              >
                {v}
              </button>
            ))}
          </>
        )}
        <button className="btn btn-primary"
          disabled={chosen === null}
          onClick={() => onAgree(chosen)}
          style={{ marginLeft: 'auto' }}>
          Set {chosen} & Next →
        </button>
      </div>
    </div>
  )
}

/* ── Jira helpers ── */
const JQL_RE = /\b(AND|OR|NOT|ORDER\s+BY|project|sprint|status|assignee|reporter|priority|issuetype|fixVersion|component|label|created|updated|due)\b|[=!~]/i
const isJql = q => JQL_RE.test(q.trim())

function getJiraAuth() {
  try { return JSON.parse(localStorage.getItem(LS_JIRA_KEY) || 'null') } catch { return null }
}

function saveJiraAuth(auth) {
  if (auth) localStorage.setItem(LS_JIRA_KEY, JSON.stringify(auth))
  else localStorage.removeItem(LS_JIRA_KEY)
}

async function ensureFreshToken(auth) {
  if (!auth) return null
  if (auth.expiresAt - Date.now() > 60_000) return auth
  try {
    const res = await fetch('/api/jira/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const updated = { ...auth, accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt }
    saveJiraAuth(updated)
    return updated
  } catch { return null }
}

/* ── Jira Import Modal ── */
function JiraModal({ onImport, onClose, existingJiraKeys = new Set() }) {
  const [auth, setAuth] = useState(() => getJiraAuth())
  const [query, setQuery] = useState('')
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const modalRef = useModalA11y(onClose)
  const debounceRef = useRef(null)
  const mode = isJql(query) ? 'JQL' : 'Text'

  const disconnect = () => { saveJiraAuth(null); setAuth(null); setIssues([]); setSelected(new Set()) }

  const fetchIssues = async (q, currentAuth) => {
    setLoading(true)
    setError(null)
    try {
      const fresh = await ensureFreshToken(currentAuth)
      if (!fresh) { setAuth(null); saveJiraAuth(null); return }
      setAuth(fresh)
      const res = await fetch(`/api/jira/issues?q=${encodeURIComponent(q)}&cloudId=${encodeURIComponent(fresh.cloudId)}`, {
        headers: { Authorization: `Bearer ${fresh.accessToken}` },
      })
      if (res.status === 401) { setAuth(null); saveJiraAuth(null); setError('Session expired — reconnect to Jira.'); return }
      if (!res.ok) { setError('Failed to load issues.'); return }
      const data = await res.json()
      setIssues(data.issues || [])
    } catch { setError('Failed to load issues.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!auth) return
    if (!query.trim()) { setIssues([]); return }
    if (isJql(query)) return // JQL fires on Enter only
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchIssues(query, auth), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, auth])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isJql(query) && auth) fetchIssues(query, auth)
  }

  const toggle = key => {
    if (existingJiraKeys.has(key)) return
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const handleImport = () => {
    const picked = issues.filter(i => selected.has(i.key))
    onImport(picked)
  }

  const jiraAuthUrl = import.meta.env.DEV
    ? 'http://localhost:3001/api/jira/auth'
    : '/api/jira/auth'

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="jira-modal-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title" id="jira-modal-title">Add from Jira</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {auth && (
              <button className="btn btn-ghost btn-sm" onClick={disconnect}
                style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 6px' }}>
                {auth.email} · disconnect
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {!auth ? (
          <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              Connect your Atlassian account to search and import issues.
            </p>
            <div>
              <a href={jiraAuthUrl} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Authorize Jira →
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="jira-search-wrap">
              <input
                className="input"
                placeholder="Search or enter JQL…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <span className="jira-mode-label">{mode}</span>
            </div>
            {mode === 'JQL' && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px', opacity: 0.7 }}>
                Press Enter to run query
              </p>
            )}
            {error && <p style={{ fontSize: 12, color: 'var(--error)', margin: 0 }}>{error}</p>}

            <div className="jira-issues">
              {loading && [0, 1, 2].map(i => (
                <div key={i} className="jira-skeleton" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
              {!loading && !error && issues.length === 0 && query.trim() && (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>No issues found.</div>
              )}
              {!loading && !query.trim() && (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>
                  Search for issues or enter a JQL query.
                </div>
              )}
              {!loading && issues.map(issue => {
                const alreadyAdded = existingJiraKeys.has(issue.key)
                const isSelected = selected.has(issue.key)
                return (
                  <div
                    key={issue.key}
                    className={`jira-issue-row ${isSelected ? 'selected' : ''} ${alreadyAdded ? 'already-added' : ''}`}
                    role={alreadyAdded ? undefined : 'checkbox'}
                    aria-checked={alreadyAdded ? undefined : isSelected}
                    tabIndex={alreadyAdded ? -1 : 0}
                    onClick={() => toggle(issue.key)}
                    onKeyDown={e => { if (!alreadyAdded && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(issue.key) } }}
                  >
                    <div className="jira-checkbox" aria-hidden="true">
                      {alreadyAdded ? '·' : isSelected ? '✓' : ''}
                    </div>
                    <div>
                      <div className="jira-key">{issue.key}</div>
                      <div className="jira-issue-title">{issue.title}</div>
                      {issue.desc && <div className="jira-issue-desc">{issue.desc}</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--muted2)' }}>
                {selected.size > 0 ? `${selected.size} selected` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" disabled={!selected.size} onClick={handleImport}>
                  Add to room{selected.size > 0 ? ` (${selected.size})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Add Story Modal ── */
function AddStoryModal({ onAdd, onClose, onSwitchToJira }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const modalRef = useModalA11y(onClose)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="add-story-modal-title" style={{ width: 'min(420px, 94vw)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title" id="add-story-modal-title">Add Story</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="field-label">Title</label>
            <input className="input" placeholder="As a user, I want to…" value={title}
              onChange={e => setTitle(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && title.trim() && (onAdd({ title: title.trim(), desc: desc.trim() }), onClose())} />
          </div>
          <div>
            <label className="field-label">Description (optional)</label>
            <textarea className="input" rows={3} placeholder="Acceptance criteria, context…"
              value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={onSwitchToJira}>
            Import from Jira →
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!title.trim()}
              onClick={() => { onAdd({ title: title.trim(), desc: desc.trim() }); onClose() }}>
              Add Story
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Share Button ── */
function ShareButton({ roomName }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button className={`btn btn-sm ${copied ? 'btn-green' : 'btn-ghost'}`} onClick={handle}>
      {copied ? '✓ Copied' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Invite</>}
    </button>
  )
}

/* ── Top Bar ── */
function TopBar({ roomName, me, isVoting, onToggleVoting, onLeave }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-sm" onClick={onLeave} style={{ marginRight: 4 }} aria-label="Back to lobby">←</button>
        <div className="topbar-room">{roomName}</div>
        <ShareButton roomName={roomName} />
      </div>
      <div className="topbar-right">
        <Toggle on={!isVoting} onChange={v => onToggleVoting(!v)} label="Observer mode" />
        <div className="user-chip">
          <div className="user-avatar">{me?.name?.[0]?.toUpperCase() || '?'}</div>
          <span>{me?.name}{me?.isFacilitator ? ' ★' : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Bottom bar ── */
function BottomBar({ phase, me, participants, hasVoted, myVote, onReveal, onClearVote, onRevote }) {
  const voters = participants.filter(p => p.role === 'voter')
  const votedCount = voters.filter(p => hasVoted.has(p.id)).length
  const totalVoters = voters.length
  const notVotedNames = voters
    .filter(p => !hasVoted.has(p.id))
    .map(p => p.id === me?.id ? 'you' : p.name)
  const waitingCopy = notVotedNames.length === 1
    ? `Waiting for ${notVotedNames[0]}…`
    : notVotedNames.length === 2
    ? `Waiting for ${notVotedNames[0]} and ${notVotedNames[1]}…`
    : notVotedNames.length > 2
    ? `Waiting for ${notVotedNames.slice(0, -1).join(', ')} and ${notVotedNames[notVotedNames.length - 1]}…`
    : null
  return (
    <div className="bottombar">
      {phase === 'voting' && (
        <>
          {myVote !== null && (
            <button className="btn btn-ghost btn-sm" onClick={onClearVote}>Clear vote</button>
          )}
          <div style={{ flex: 1 }} />
          {votedCount > 0 && votedCount < totalVoters && (
            <span className="pulse" style={{ fontSize: 13, color: 'var(--muted2)' }}>
              {waitingCopy}
            </span>
          )}
          {votedCount > 0 && votedCount === totalVoters && (
            <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
              All votes in
            </span>
          )}
          {me?.isFacilitator && (
            <button className="btn btn-primary btn-lg" disabled={votedCount === 0} onClick={onReveal}>
              Reveal Votes →
            </button>
          )}
        </>
      )}
      {phase === 'revealed' && me?.isFacilitator && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onRevote}>↺ Re-vote</button>
        </div>
      )}
    </div>
  )
}

/* ── Room View ── */
function RoomView({ roomName, identity, onLeave }) {
  const { token, participant: me } = identity

  const [participants, setParticipants] = useState([me])
  const [stories, setStories] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState('voting')
  const [myVote, setMyVote] = useState(null)
  const [isVoting, setIsVoting] = useState(me.role === 'voter')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showJira, setShowJira] = useState(false)
  const wsRef = useRef(null)
  // Remembers each story's vote value so it can be restored when jumping back
  const myVotesRef = useRef(new Map())
  // Stable ref to currentIdx so WS handlers can read it without stale closures
  const currentIdxRef = useRef(0)

  const parseVoteValue = (raw) => {
    const n = Number(raw)
    return isNaN(n) ? raw : n
  }

  // Helpers to update a single story's votes list without touching others
  const upsertVoteInStory = (votes, entry) => [
    ...(votes || []).filter(v => v.participantId !== entry.participantId),
    entry,
  ]
  const removeVoteFromStory = (votes, participantId) =>
    (votes || []).filter(v => v.participantId !== participantId)

  // WS connection with auto-reconnect
  useEffect(() => {
    let unmounted = false
    let retryTimer = null

    function connect() {
      const ws = new WebSocket(getWsUrl(roomName, token))
      wsRef.current = ws
      let didOpen = false

      ws.onopen = () => { didOpen = true }

      ws.onclose = (e) => {
        if (e.code === 4001 || e.code === 4003) {
          localStorage.removeItem(LS_KEY_IDENTITY)
          onLeave()
          return
        }
        if (!unmounted && didOpen) retryTimer = setTimeout(connect, 2000)
      }

      ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      switch (msg.type) {
        case 'room:state': {
          const { room } = msg
          setParticipants(room.participants)

          const sorted = [...room.stories].sort((a, b) => a.position - b.position)
          setStories(sorted)

          // All stories estimated → completed screen
          if (sorted.length > 0 && sorted.every(s => s.points !== null)) {
            setCurrentIdx(Math.max(0, sorted.length - 1))
            setPhase('complete')
            break
          }

          // First unestimated story is the active one
          const idx = sorted.findIndex(s => s.points === null && s.phase !== 'agreed')
          const activeIdx = idx === -1 ? Math.max(0, sorted.length - 1) : idx
          setCurrentIdx(activeIdx)

          const active = sorted[activeIdx]
          if (active) {
            // Server uses 'agreed' after score is set; show it as 'voting' for the next story,
            // but if it's the active one and revealed, show revealed
            const serverPhase = active.phase === 'agreed' ? 'voting' : active.phase
            setPhase(serverPhase)
            if (serverPhase === 'revealed') {
              const myEntry = active.votes.find(v => v.participantId === me.id && v.value !== undefined)
              setMyVote(myEntry ? parseVoteValue(myEntry.value) : null)
            } else {
              setMyVote(null)
            }
          }
          break
        }

        case 'vote:cast': {
          const { storyId, participantId, hasVoted } = msg
          setStories(ss => ss.map(s => {
            if (s.id !== storyId) return s
            return {
              ...s,
              votes: hasVoted
                ? upsertVoteInStory(s.votes, { participantId, hasVoted: true })
                : removeVoteFromStory(s.votes, participantId),
            }
          }))
          break
        }

        case 'vote:reveal': {
          const { storyId, votes } = msg
          const updatedVotes = votes.map(v => ({ participantId: v.participantId, participantName: v.participantName, value: v.value }))
          setStories(ss => {
            const storyIdx = ss.findIndex(s => s.id === storyId)
            if (storyIdx === -1) return ss
            // Only flip local display state when the user is viewing this story
            if (storyIdx === currentIdxRef.current) {
              setPhase('revealed')
              const myEntry = updatedVotes.find(v => v.participantId === me.id)
              if (myEntry) setMyVote(parseVoteValue(myEntry.value))
            }
            return ss.map(s => s.id !== storyId ? s : { ...s, phase: 'revealed', votes: updatedVotes })
          })
          break
        }

        case 'story:agreed': {
          const { storyId, score, nextStoryId } = msg
          setStories(ss => {
            const updated = ss.map(s =>
              // preserve existing votes so jumping back shows correct data
              s.id === storyId ? { ...s, points: score, phase: 'agreed' } : s
            )
            if (nextStoryId) {
              const nextIdx = updated.findIndex(s => s.id === nextStoryId)
              if (nextIdx !== -1) setCurrentIdx(nextIdx)
            }
            return updated
          })
          if (nextStoryId) {
            setPhase('voting')
            setMyVote(null)
          } else {
            setPhase('complete')
          }
          break
        }

        case 'story:reset': {
          const { storyId } = msg
          setStories(ss => {
            const storyIdx = ss.findIndex(s => s.id === storyId)
            if (storyIdx === currentIdxRef.current) {
              setPhase('voting')
              setMyVote(null)
              myVotesRef.current.delete(storyId)
            }
            return ss.map(s => s.id !== storyId ? s : { ...s, phase: 'voting', points: null, votes: [] })
          })
          break
        }

        case 'story:added': {
          setStories(ss => {
            if (ss.find(s => s.id === msg.story.id)) return ss
            return [...ss, msg.story].sort((a, b) => a.position - b.position)
          })
          break
        }

        case 'story:reorder': {
          const { storyIds } = msg
          setStories(ss => {
            const map = new Map(ss.map(s => [s.id, s]))
            return storyIds.map((id, i) => ({ ...map.get(id), position: i })).filter(s => s.id)
          })
          break
        }

        case 'participant:joined': {
          setParticipants(pp => pp.find(p => p.id === msg.participant.id) ? pp : [...pp, msg.participant])
          break
        }

        case 'participant:left': {
          setParticipants(pp => pp.filter(p => p.id !== msg.participantId))
          break
        }

        case 'observer:toggled': {
          setParticipants(pp => pp.map(p =>
            p.id === msg.participantId ? { ...p, role: msg.role } : p
          ))
          if (msg.participantId === me.id) setIsVoting(msg.role === 'voter')
          break
        }
      }
      }
    }

    connect()

    return () => {
      unmounted = true
      clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [roomName, token])

  const wsSend = (msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  // Keep currentIdxRef in sync so WS handlers can read it
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])

  // Derive vote state from the current story — this scopes all vote display to the right story
  const currentStory = stories[currentIdx]
  const observerIds = new Set(participants.filter(p => p.role === 'observer').map(p => p.id))
  const currentVotes = (currentStory?.votes || []).filter(v => !observerIds.has(v.participantId))
  const hasVoted = new Set(currentVotes.map(v => v.participantId))
  const revealedVotes = Object.fromEntries(
    currentVotes.filter(v => v.value !== undefined).map(v => [v.participantId, parseVoteValue(v.value)])
  )

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'voting' || !isVoting) return
    const KEY_MAP = { '1': 1, '2': 2, '3': 3, '4': 5, '5': 8, '6': 13, '7': 21, '8': '?' }
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (KEY_MAP[e.key] !== undefined) handleVote(KEY_MAP[e.key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, isVoting, currentStory?.id])

  const handleVote = (value) => {
    if (!currentStory) return
    setMyVote(value)
    myVotesRef.current.set(currentStory.id, value)
    // Optimistic update so the checkmark appears immediately
    setStories(ss => ss.map(s =>
      s.id !== currentStory.id ? s
        : { ...s, votes: upsertVoteInStory(s.votes, { participantId: me.id, hasVoted: true }) }
    ))
    wsSend({ type: 'vote', storyId: currentStory.id, value })
  }

  const handleClearVote = () => {
    if (!currentStory) return
    setMyVote(null)
    myVotesRef.current.delete(currentStory.id)
    setStories(ss => ss.map(s =>
      s.id !== currentStory.id ? s
        : { ...s, votes: removeVoteFromStory(s.votes, me.id) }
    ))
    wsSend({ type: 'vote', storyId: currentStory.id, value: null })
  }

  const handleReveal = () => {
    if (!currentStory || !me.isFacilitator) return
    wsSend({ type: 'reveal', storyId: currentStory.id })
  }

  const handleAgree = (score) => {
    if (!currentStory || !me.isFacilitator) return
    wsSend({ type: 'agree', storyId: currentStory.id, score })
  }

  const handleRevote = () => {
    if (!currentStory || !me.isFacilitator) return
    wsSend({ type: 'reset', storyId: currentStory.id })
  }

  const handleToggleObserver = (voting) => {
    setIsVoting(voting)
    wsSend({ type: 'observer:toggle', role: voting ? 'voter' : 'observer' })
  }

  const handleJump = (i) => {
    if (i === currentIdx) return
    const target = stories[i]
    if (!target) return
    setCurrentIdx(i)
    if (target.phase !== 'voting') {
      setPhase('revealed')
      // Restore my vote value from revealed data (if available)
      const myEntry = target.votes.find(v => v.participantId === me.id && v.value !== undefined)
      setMyVote(myEntry ? parseVoteValue(myEntry.value) : null)
    } else {
      setPhase('voting')
      // Restore whatever this user had previously selected for this story
      setMyVote(myVotesRef.current.get(target.id) ?? null)
    }
  }

  const handleAddStory = async ({ title, desc }) => {
    try {
      await api(`/rooms/${encodeURIComponent(roomName)}/stories`, {
        method: 'POST',
        body: { title, desc },
      })
    } catch (err) {
      console.error('Failed to add story:', err)
    }
  }

  const handleImportJira = async (issues) => {
    try {
      await api(`/rooms/${encodeURIComponent(roomName)}/stories/batch`, {
        method: 'POST',
        body: issues.map(i => ({ title: i.title, desc: i.desc, jiraKey: i.key })),
      })
    } catch (err) {
      console.error('Failed to import stories:', err)
    }
    setShowJira(false)
  }

  // displayVoters: voting phase = connected voters, revealed phase = everyone who cast a vote
  const displayParticipants = phase === 'revealed'
    ? (currentStory?.votes ?? []).map(v => ({
        id: v.participantId,
        name: v.participantName,
        role: 'voter',
        isFacilitator: false,
      }))
    : participants

  // Stats for reveal
  const revealedValues = Object.values(revealedVotes)
  const numVotes = revealedValues.filter(v => typeof v === 'number')
  const outlier = numVotes.length > 2 && (Math.max(...numVotes) - Math.min(...numVotes) >= 5)
    ? (() => {
        const maxVal = Math.max(...numVotes)
        const pid = Object.entries(revealedVotes).find(([, v]) => v === maxVal)?.[0]
        return currentStory?.votes.find(v => v.participantId === pid)?.participantName ?? null
      })()
    : null

  if (phase === 'complete') {
    const totalPoints = stories.reduce((sum, s) => {
      const n = Number(s.points)
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
    return (
      <div className="complete-view">
        <div style={{ textAlign: 'center' }}>
          <div className="complete-count">{stories.length}</div>
          <div className="complete-count-label">Stories estimated</div>
        </div>
        <div className="complete-table">
          {stories.map(s => (
            <div key={s.id} className="complete-row">
              <span className="complete-row-title">{s.title}</span>
              <span className="badge badge-green">{s.points}</span>
            </div>
          ))}
          <div className="complete-row" style={{ background: 'var(--s1)' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)'
            }}>Total</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--accent)'
            }}>{totalPoints} pts</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-lg" onClick={onLeave}>← Lobby</button>
          <button className="btn btn-primary btn-lg"
            onClick={() => {
              const target = stories[0]
              if (!target) return
              setCurrentIdx(0)
              if (target.phase !== 'voting') {
                setPhase('revealed')
                const myEntry = target.votes.find(v => v.participantId === me.id && v.value !== undefined)
                setMyVote(myEntry ? parseVoteValue(myEntry.value) : null)
              } else {
                setPhase('voting')
                setMyVote(myVotesRef.current.get(target.id) ?? null)
              }
            }}>
            Review Estimates
          </button>
        </div>
      </div>
    )
  }

  if (!currentStory) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Connecting…
      </div>
    )
  }

  return (
    <>
      <TopBar roomName={roomName} me={me}
        isVoting={isVoting} onToggleVoting={handleToggleObserver} onLeave={onLeave} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <StorySidebar stories={stories} currentIdx={currentIdx}
          isFacilitator={me.isFacilitator}
          onAdd={() => setShowAddModal(true)}
          onJump={handleJump}
          onReorder={orderedIds => {
            setStories(ss => {
              const map = new Map(ss.map(s => [s.id, s]))
              return orderedIds.map((id, i) => ({ ...map.get(id), position: i }))
            })
            wsSend({ type: 'story:reorder', storyIds: orderedIds })
          }}
          participants={participants}
          me={me} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ActiveStoryCard story={currentStory} num={currentIdx + 1} total={stories.length} />
          <ParticipantsRow
            me={me}
            displayParticipants={displayParticipants}
            hasVoted={hasVoted}
            revealedVotes={phase === 'revealed' ? revealedVotes : {}}
            revealed={phase === 'revealed'} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {phase === 'voting' && isVoting && (
              <VotingCards selected={myVote} onSelect={handleVote} />
            )}
            {phase === 'voting' && !isVoting && (
              <div style={{ padding: '24px 24px', color: 'var(--muted)', fontSize: 13 }}>
                Observing this round.
              </div>
            )}
            {phase === 'revealed' && (
              <div className="fade-up">
                <RevealStats votes={revealedValues} outlierName={outlier} />
                {me.isFacilitator && (
                  <AgreeScore key={currentStory?.id} revealedVotes={revealedVotes} existingScore={currentStory?.points} onAgree={handleAgree} />
                )}
              </div>
            )}
          </div>
          <BottomBar
            phase={phase}
            me={me}
            participants={participants}
            hasVoted={hasVoted}
            myVote={myVote}
            onReveal={handleReveal}
            onClearVote={handleClearVote}
            onRevote={handleRevote} />
        </div>
      </div>

      {showAddModal && (
        <AddStoryModal
          onAdd={handleAddStory}
          onClose={() => setShowAddModal(false)}
          onSwitchToJira={() => { setShowAddModal(false); setShowJira(true) }} />
      )}
      {showJira && (
        <JiraModal
          existingJiraKeys={new Set(stories.filter(s => s.jiraKey).map(s => s.jiraKey))}
          onImport={handleImportJira}
          onClose={() => setShowJira(false)} />
      )}
    </>
  )
}

/* ── Landing view ── */
function LandingView({ displayName, onDisplayNameChange, onCreateRoom, onJoined }) {
  const [joinInput, setJoinInput] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    let roomName = joinInput.trim()
    try { roomName = new URL(roomName).searchParams.get('room') || roomName } catch { /* not a URL */ }
    if (!roomName || !displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api(`/rooms/${encodeURIComponent(roomName)}/join`, {
        method: 'POST',
        body: { displayName: displayName.trim() },
      })
      onJoined({ roomName: data.room.name, identity: { token: data.token, participant: data.participant } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1 className="landing-heading"><em>Baseline</em></h1>
        <p className="landing-sub">Estimate stories as a team — focused, structured, decisive.</p>
        <div className="landing-actions">
          <div>
            <label className="field-label">Your name</label>
            <input className="input" placeholder="e.g. Alex" value={displayName}
              onChange={e => onDisplayNameChange(e.target.value)} autoFocus />
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
            disabled={!displayName.trim()}
            onClick={onCreateRoom}>
            Create Room
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Paste invite link or room name…" style={{ flex: 1 }}
              value={joinInput} onChange={e => setJoinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()} />
            <button className="btn btn-ghost"
              disabled={!joinInput.trim() || !displayName.trim() || loading}
              onClick={handleJoin}>
              {loading ? '…' : 'Join'}
            </button>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Join view (invite link) ── */
function JoinView({ roomName, displayName, onDisplayNameChange, onJoined, onBack }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    if (!displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api(`/rooms/${encodeURIComponent(roomName)}/join`, {
        method: 'POST',
        body: { displayName: displayName.trim() },
      })
      onJoined({ roomName: data.room.name, identity: { token: data.token, participant: data.participant } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1 className="landing-heading"><em>Baseline</em></h1>
        <p className="landing-sub">You've been invited to <strong>{roomName}</strong>.</p>
        <div className="landing-actions">
          <div>
            <label className="field-label">Your name</label>
            <input className="input" placeholder="e.g. Alex" value={displayName}
              onChange={e => onDisplayNameChange(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
            disabled={!displayName.trim() || loading}
            onClick={handleJoin}>
            {loading ? 'Joining…' : 'Join'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onBack}>
            ← Back to lobby
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Create room view ── */
function CreateRoomView({ displayName: initialName, onDisplayNameChange, onCreated, onBack }) {
  const [roomName, setRoomName] = useState('')
  const [displayName, setDisplayName] = useState(initialName || '')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!roomName.trim() || !displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api('/rooms', {
        method: 'POST',
        body: { name: roomName.trim(), displayName: displayName.trim() },
      })
      onDisplayNameChange(displayName.trim())
      onCreated({ roomName: data.room.name, identity: { token: data.token, participant: data.participant } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-view">
      <div className="form-inner">
        <div>
          <div className="form-heading">New Room</div>
          <p className="form-sub">Give this room a name so your team knows what to join.</p>
        </div>
        <div>
          <label className="field-label">Your name</label>
          <input className="input" placeholder="e.g. Alex" value={displayName}
            onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Room name</label>
          <input className="input" placeholder="e.g. Baseline Team" value={roomName}
            onChange={e => setRoomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus />
        </div>
        <div className="card-preview">
          <div className="card-preview-title">Card scale · Fibonacci</div>
          <div className="card-preview-chips">
            {FIBS.map(v => (
              <div key={v} className="card-chip">{v}</div>
            ))}
          </div>
          <div className="card-preview-note">Locked for this room</div>
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
            disabled={!roomName.trim() || !displayName.trim() || loading}
            onClick={handleCreate}>
            {loading ? 'Creating…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Add stories view ── */
function AddStoriesView({ roomName, onStart }) {
  const [stories, setStories]   = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [showJira, setShowJira] = useState(false)
  const [loading, setLoading]   = useState(false)

  const addLocal = () => {
    if (!newTitle.trim()) return
    setStories(ss => [...ss, { id: Date.now(), title: newTitle.trim(), desc: newDesc.trim() }])
    setNewTitle('')
    setNewDesc('')
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      if (stories.length > 0) {
        await api(`/rooms/${encodeURIComponent(roomName)}/stories/batch`, {
          method: 'POST',
          body: stories.map(s => ({ title: s.title, desc: s.desc })),
        })
      }
      onStart()
    } catch (err) {
      console.error('Failed to add stories:', err)
      setLoading(false)
    }
  }

  return (
    <div className="add-stories-view">
      <div className="add-stories-form">
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: 6,
          }}>{roomName}</div>
          <div className="form-heading" style={{ fontSize: 22 }}>Add Stories</div>
          <p className="form-sub" style={{ marginTop: 4 }}>Add the stories you want to estimate.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder="Story title…" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newTitle.trim() && addLocal()} />
          <textarea className="input" rows={2} placeholder="Description (optional)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={!newTitle.trim()} onClick={addLocal}>
              Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJira(true)}>
              Import from Jira
            </button>
          </div>
        </div>
        <button className="btn btn-green btn-lg" disabled={stories.length === 0 || loading}
          onClick={handleStart} style={{ marginTop: 'auto' }}>
          {loading ? 'Starting…' : `Start (${stories.length} ${stories.length === 1 ? 'story' : 'stories'}) →`}
        </button>
      </div>
      <div className="add-stories-list">
        <div className="label" style={{ display: 'block', marginBottom: 16 }}>Stories to estimate</div>
        {stories.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 40 }}>
            No stories yet — add one on the left, or import from Jira.
          </p>
        ) : (
          <div>
            {stories.map((s, i) => (
              <div key={s.id} className="story-list-item">
                <span className="story-list-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="story-list-title">{s.title}</div>
                  {s.desc && <div className="story-list-desc">{s.desc}</div>}
                </div>
                <button className="story-list-remove"
                  onClick={() => setStories(ss => ss.filter(x => x.id !== s.id))}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showJira && (
        <JiraModal
          existingJiraKeys={new Set(stories.filter(s => s.jiraKey).map(s => s.jiraKey))}
          onImport={issues => {
            setStories(ss => [...ss, ...issues.map(i => ({
              id: Date.now() + Math.random(), title: i.title, desc: i.desc, jiraKey: i.key,
            }))])
            setShowJira(false)
          }}
          onClose={() => setShowJira(false)} />
      )}
    </div>
  )
}

/* ── Root App ── */
export default function App() {
  const [inviteRoom, setInviteRoom] = useState(
    () => new URLSearchParams(window.location.search).get('room')
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('jira_access_token')
    if (!accessToken) return
    saveJiraAuth({
      accessToken,
      refreshToken: params.get('jira_refresh_token'),
      cloudId: params.get('jira_cloud_id'),
      email: params.get('jira_email'),
      expiresAt: Number(params.get('jira_expires_at')),
    })
    const clean = new URLSearchParams(window.location.search)
    ;['jira_access_token', 'jira_refresh_token', 'jira_cloud_id', 'jira_email', 'jira_expires_at'].forEach(k => clean.delete(k))
    const qs = clean.toString()
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('baseline_display_name') || ''
  )
  const [identity, setIdentity] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_IDENTITY) || 'null') } catch { return null }
  })
  const [view, setView] = useState(() => {
    const invite = new URLSearchParams(window.location.search).get('room')
    if (invite) return 'landing'
    const savedView = localStorage.getItem(LS_KEY + '_view')
    if (identity && savedView === 'stories') return 'stories'
    if (identity) return 'room'
    return savedView || 'landing'
  })
  const [roomName, setRoomName] = useState(() => {
    const invite = new URLSearchParams(window.location.search).get('room')
    if (invite) return invite
    return identity?.roomName || localStorage.getItem(LS_KEY + '_room') || ''
  })

  const handleClearInvite = () => {
    setInviteRoom(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  useEffect(() => {
    localStorage.setItem('baseline_display_name', displayName)
  }, [displayName])

  useEffect(() => {
    localStorage.setItem(LS_KEY + '_view', view)
    localStorage.setItem(LS_KEY + '_room', roomName)
  }, [view, roomName])

  useEffect(() => {
    if (identity) localStorage.setItem(LS_KEY_IDENTITY, JSON.stringify(identity))
    else localStorage.removeItem(LS_KEY_IDENTITY)
  }, [identity])

  const handleCreated = ({ roomName: name, identity: id }) => {
    setRoomName(name)
    setIdentity({ ...id, roomName: name })
    setView('stories')
  }

  const handleJoined = ({ roomName: name, identity: id }) => {
    setRoomName(name)
    setIdentity({ ...id, roomName: name })
    setView('room')
  }

  const handleStart = () => setView('room')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {view === 'landing' && inviteRoom && (
        <JoinView
          roomName={inviteRoom}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          onJoined={handleJoined}
          onBack={handleClearInvite} />
      )}
      {view === 'landing' && !inviteRoom && (
        <LandingView
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          onCreateRoom={() => setView('create')}
          onJoined={handleJoined} />
      )}
      {view === 'create' && (
        <CreateRoomView
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          onCreated={handleCreated}
          onBack={() => setView('landing')} />
      )}
      {view === 'stories' && identity && (
        <AddStoriesView
          roomName={roomName}
          onStart={handleStart} />
      )}
      {view === 'room' && identity && (
        <RoomView
          roomName={roomName}
          identity={identity}
          onLeave={() => setView('landing')} />
      )}
    </div>
  )
}
