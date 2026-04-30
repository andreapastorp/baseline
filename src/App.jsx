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
const JIRA_ISSUES = [
  { key: 'AXN-101', title: 'User authentication flow',     desc: 'Implement OAuth 2.0 login with Google and GitHub' },
  { key: 'AXN-102', title: 'Dashboard analytics widget',   desc: 'Show active users, events, and conversion on home' },
  { key: 'AXN-103', title: 'Export to CSV',               desc: 'Allow bulk data export from all table views' },
  { key: 'AXN-104', title: 'Dark mode support',           desc: 'Theme toggle with system preference detection' },
  { key: 'AXN-105', title: 'Mobile responsive nav',       desc: 'Collapsible sidebar and touch-friendly controls' },
  { key: 'AXN-106', title: 'Email notification settings', desc: 'Per-user preference controls for all notification types' },
]
const LS_KEY = 'baseline_planning_state'
const LS_KEY_IDENTITY = 'baseline_identity'

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
function ParticipantsRow({ me, participants, hasVoted, revealedVotes, revealed }) {
  const voters = participants.filter(p => p.role === 'voter')
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
        {participants.map((p, i) => {
          const isMe = p.id === me?.id
          const voted = hasVoted.has(p.id)
          const val = revealedVotes[p.id] ?? null
          return (
            <div key={p.id} className="participant-col"
              style={{ opacity: p.role === 'observer' ? 0.4 : 1 }}>
              {p.role === 'voter'
                ? <PCard voted={voted} value={val} revealed={revealed} delay={i * 120} />
                : <div
                    aria-label={`${p.name} — observer`}
                    style={{
                      width: 40, height: 56,
                      border: '1px solid var(--border)',
                      background: 'var(--s2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.06em', color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}>
                    <span aria-hidden="true">obs</span>
                  </div>
              }
              <span className={`participant-name ${isMe ? 'is-me' : ''}`}>
                {p.name}{p.isFacilitator ? ' ★' : ''}
              </span>
            </div>
          )
        })}
        {!revealed && (
          <div className="vote-dots" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <span className="sr-only">{votedCount} of {voters.length} voted</span>
            {voters.map(p => (
              <div key={p.id} className={`vote-dot ${hasVoted.has(p.id) ? 'voted' : 'waiting'}`} aria-hidden="true" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Story sidebar row ── */
function StoryRow({ story, active, onClick }) {
  return (
    <button
      className={`story-row ${active ? 'active' : ''} ${story.points !== null ? 'done' : ''}`}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
    >
      <span className="story-row-num">{story.num}</span>
      <span className="story-title">{story.title}</span>
      {story.points !== null
        ? <span className="story-pts">{story.points}</span>
        : active
          ? <span className="story-arrow" aria-hidden="true">▶</span>
          : null}
    </button>
  )
}

/* ── Story sidebar ── */
function StorySidebar({ stories, currentIdx, isFacilitator, onAdd, onJump }) {
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
      <div className="sidebar-list">
        {stories.map((s, i) => (
          <StoryRow key={s.id} story={{ ...s, num: i + 1 }} active={i === currentIdx}
            onClick={() => onJump && onJump(i)} />
        ))}
      </div>
      <div className="sidebar-footer">
        {stories.filter(s => s.points !== null).length} done
        {' · '}
        {stories.filter(s => s.points === null).length} remaining
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
function AgreeScore({ revealedVotes, onAgree }) {
  const allVotes = Object.values(revealedVotes).filter(v => typeof v === 'number')
  const freq = {}
  allVotes.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const sorted = [...new Set(allVotes)].sort((a, b) => a - b)
  const suggested = sorted.length ? sorted.reduce((a, b) => (freq[a] || 0) >= (freq[b] || 0) ? a : b) : null
  const [chosen, setChosen] = useState(suggested)
  const [custom, setCustom] = useState('')
  // Reset choices whenever votes change (new reveal)
  const votesKey = JSON.stringify(revealedVotes)
  useEffect(() => { setChosen(suggested); setCustom('') }, [votesKey])
  return (
    <div className="agree-section">
      <span className="label">Set Agreed Score</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>facilitator</span>
      <div className="agree-row">
        {sorted.map(v => (
          <button
            key={v}
            className={`vcard-sm ${chosen === v ? 'chosen' : ''}`}
            onClick={() => { setChosen(v); setCustom('') }}
            aria-pressed={chosen === v}
            aria-label={`Score ${v}`}
          >
            {v}
          </button>
        ))}
        <input className="input" placeholder="custom…" value={custom}
          aria-label="Custom score"
          onChange={e => { setCustom(e.target.value); setChosen(null) }}
          style={{ width: 80, padding: '7px 10px', fontSize: 13 }} />
        <button className="btn btn-primary"
          disabled={chosen === null && !custom}
          onClick={() => onAgree(custom || chosen)}
          style={{ marginLeft: 'auto' }}>
          Set {custom || chosen} & Next →
        </button>
      </div>
    </div>
  )
}

/* ── Jira Import Modal ── */
function JiraModal({ onImport, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [query, setQuery] = useState('')
  const modalRef = useModalA11y(onClose)
  const toggle = k => setSelected(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const filtered = JIRA_ISSUES.filter(i =>
    !query.trim() ||
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.key.toLowerCase().includes(query.toLowerCase()) ||
    i.desc.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="jira-modal-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title" id="jira-modal-title">Import from Jira</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Search or JQL (e.g. sprint = active)…"
            value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          {query && <button className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Project: <strong style={{ color: 'var(--text2)' }}>Team Axon</strong>
          {' · '}{filtered.length} issue{filtered.length !== 1 ? 's' : ''}
        </div>
        <div className="jira-issues">
          {filtered.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No issues match your search.
            </div>
          )}
          {filtered.map(issue => (
            <div key={issue.key}
              className={`jira-issue-row ${selected.has(issue.key) ? 'selected' : ''}`}
              role="checkbox"
              aria-checked={selected.has(issue.key)}
              tabIndex="0"
              onClick={() => toggle(issue.key)}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(issue.key) } }}>
              <div className="jira-checkbox" aria-hidden="true">{selected.has(issue.key) ? '✓' : ''}</div>
              <div>
                <div className="jira-key">{issue.key}</div>
                <div className="jira-issue-title">{issue.title}</div>
                <div className="jira-issue-desc">{issue.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!selected.size}
              onClick={() => onImport(JIRA_ISSUES.filter(i => selected.has(i.key)))}>
              Import {selected.size > 0 ? selected.size : ''} {selected.size === 1 ? 'story' : 'stories'}
            </button>
          </div>
        </div>
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
function TopBar({ roomName, me, participants, isVoting, onToggleVoting, onLeave }) {
  const others = participants.filter(p => me && p.id !== me.id)
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-sm" onClick={onLeave} style={{ marginRight: 4 }} aria-label="Back to lobby">←</button>
        <div className="topbar-room">{roomName}</div>
        <div className="topbar-players">
          {others.map((p, i) => (
            <div key={p.id} className="topbar-avatar" style={{ zIndex: others.length - i }}>
              {p.name[0].toUpperCase()}
            </div>
          ))}
        </div>
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

  // WS connection
  useEffect(() => {
    const ws = new WebSocket(getWsUrl(roomName, token))
    wsRef.current = ws

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
          const updatedVotes = votes.map(v => ({ participantId: v.participantId, value: v.value }))
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

        case 'participant:joined': {
          setParticipants(pp => {
            if (pp.find(p => p.id === msg.participant.id)) return pp
            return [...pp, msg.participant]
          })
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

    return () => ws.close()
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
  const currentVotes = currentStory?.votes || []
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
        body: issues.map(i => ({ title: i.title, desc: i.desc })),
      })
    } catch (err) {
      console.error('Failed to import stories:', err)
    }
    setShowJira(false)
  }

  // Stats for reveal
  const revealedValues = Object.values(revealedVotes)
  const numVotes = revealedValues.filter(v => typeof v === 'number')
  const outlier = numVotes.length > 2 && (Math.max(...numVotes) - Math.min(...numVotes) >= 5)
    ? (() => {
        const maxVal = Math.max(...numVotes)
        const pid = Object.entries(revealedVotes).find(([, v]) => v === maxVal)?.[0]
        return participants.find(p => p.id === pid)?.name
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
      <TopBar roomName={roomName} me={me} participants={participants}
        isVoting={isVoting} onToggleVoting={handleToggleObserver} onLeave={onLeave} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <StorySidebar stories={stories} currentIdx={currentIdx}
          isFacilitator={me.isFacilitator}
          onAdd={() => setShowAddModal(true)}
          onJump={handleJump} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ActiveStoryCard story={currentStory} num={currentIdx + 1} total={stories.length} />
          <ParticipantsRow
            me={me}
            participants={participants}
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
                  <AgreeScore revealedVotes={revealedVotes} onAgree={handleAgree} />
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
          onImport={handleImportJira}
          onClose={() => setShowJira(false)} />
      )}
    </>
  )
}

/* ── Landing view ── */
function LandingView({ displayName, onDisplayNameChange, onCreateRoom, onJoined, inviteRoom }) {
  const [joinInput, setJoinInput] = useState(inviteRoom || '')
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
            Create Session
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
          <div className="form-heading">New Session</div>
          <p className="form-sub">Give this session a name so your team knows what to join.</p>
        </div>
        <div>
          <label className="field-label">Your name</label>
          <input className="input" placeholder="e.g. Alex" value={displayName}
            onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Session name</label>
          <input className="input" placeholder="e.g. Sprint 42 Planning" value={roomName}
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
          <div className="card-preview-note">Locked for this session</div>
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
          {loading ? 'Starting…' : `Start Session (${stories.length} ${stories.length === 1 ? 'story' : 'stories'}) →`}
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
          onImport={issues => {
            setStories(ss => [...ss, ...issues.map(i => ({
              id: Date.now() + Math.random(), title: i.title, desc: i.desc,
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
  const inviteRoom = new URLSearchParams(window.location.search).get('room')

  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('baseline_display_name') || ''
  )
  const [identity, setIdentity] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_IDENTITY) || 'null') } catch { return null }
  })
  const [view, setView] = useState(() => {
    if (inviteRoom) return 'landing'
    if (identity) return 'room'
    return localStorage.getItem(LS_KEY + '_view') || 'landing'
  })
  const [roomName, setRoomName] = useState(() => {
    if (inviteRoom) return inviteRoom
    return identity?.roomName || localStorage.getItem(LS_KEY + '_room') || ''
  })

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
      {view === 'landing' && (
        <LandingView
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          onCreateRoom={() => setView('create')}
          onJoined={handleJoined}
          inviteRoom={inviteRoom} />
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
