import { useState, useEffect, useRef } from 'react'

const FIBS = [1, 2, 3, 5, 8, 13, 21, '?']
const SIMULATED_PLAYERS = [
  { id: 'p1', name: 'Britt',  role: 'voter',    delay: 1700 },
  { id: 'p2', name: 'Carlos', role: 'voter',    delay: 2900 },
  { id: 'p3', name: 'Dana',   role: 'voter',    delay: 3800 },
  { id: 'p4', name: 'Erin',   role: 'observer', delay: null },
]
const JIRA_ISSUES = [
  { key: 'AXN-101', title: 'User authentication flow',     desc: 'Implement OAuth 2.0 login with Google and GitHub' },
  { key: 'AXN-102', title: 'Dashboard analytics widget',   desc: 'Show active users, events, and conversion on home' },
  { key: 'AXN-103', title: 'Export to CSV',               desc: 'Allow bulk data export from all table views' },
  { key: 'AXN-104', title: 'Dark mode support',           desc: 'Theme toggle with system preference detection' },
  { key: 'AXN-105', title: 'Mobile responsive nav',       desc: 'Collapsible sidebar and touch-friendly controls' },
  { key: 'AXN-106', title: 'Email notification settings', desc: 'Per-user preference controls for all notification types' },
]

const LS_KEY = 'poker_planning_state'
const randomFib = () => FIBS[Math.floor(Math.random() * 6)]

/* ── Toggle ── */
function Toggle({ on, onChange, label }) {
  return (
    <div className="toggle-wrap" onClick={() => onChange(!on)}>
      <div className={`toggle-track ${on ? 'on' : ''}`}>
        <div className="toggle-thumb" />
      </div>
      {label && <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{label}</span>}
    </div>
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
function ParticipantsRow({ myVote, simVotes, revealed }) {
  const me = { id: 'me', name: 'Alex', role: 'voter', fac: true }
  const all = [me, ...SIMULATED_PLAYERS]
  const votedCount = [myVote !== null, !!simVotes.p1, !!simVotes.p2, !!simVotes.p3].filter(Boolean).length

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em' }}>PARTICIPANTS</span>
        {!revealed
          ? <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{votedCount} / 4 voted</span>
          : <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Votes revealed</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        {all.map((p, i) => {
          const isMe = p.id === 'me'
          const voted = isMe ? myVote !== null : !!simVotes[p.id]
          const val   = isMe ? myVote : simVotes[p.id]
          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              opacity: p.role === 'observer' ? 0.45 : 1 }}>
              {p.role === 'voter'
                ? <PCard voted={voted} value={val} revealed={revealed} delay={i * 120} />
                : <div style={{ width: 36, height: 50, borderRadius: 5, border: '1.5px solid var(--border)',
                    background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--muted)' }}>obs</div>
              }
              <span style={{ fontSize: 11, color: isMe ? 'var(--accent)' : 'var(--muted2)' }}>
                {p.name}{p.fac ? ' ★' : ''}
              </span>
            </div>
          )
        })}
        {!revealed && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignSelf: 'center' }}>
            {[myVote !== null, !!simVotes.p1, !!simVotes.p2, !!simVotes.p3].map((v, i) => (
              <div key={i} style={{ width: 24, height: 4, borderRadius: 2, background: v ? 'var(--green)' : 'var(--border)' }} />
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
    <div className={`story-row ${active ? 'active' : ''} ${story.points !== null ? 'done' : ''}`} onClick={onClick}>
      <span style={{ fontSize: 11, color: 'var(--muted)', width: 20, flexShrink: 0 }}>#{story.num}</span>
      <span className="story-title" style={{ flex: 1, fontSize: 13, lineHeight: 1.3, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{story.title}</span>
      {story.points !== null
        ? <span className="badge badge-green">{story.points}</span>
        : active
          ? <span className="badge badge-accent">→</span>
          : <span style={{ width: 20 }} />}
    </div>
  )
}

/* ── Story sidebar ── */
function StorySidebar({ stories, currentIdx, isFacilitator, onAdd, onJump }) {
  return (
    <div style={{ width: 210, borderRight: '1px solid var(--border)', background: 'var(--s1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em' }}>STORIES</span>
        {isFacilitator && (
          <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={onAdd}>
            + Add / Import
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        {stories.map((s, i) => (
          <StoryRow key={s.id} story={{ ...s, num: i + 1 }} active={i === currentIdx}
            onClick={() => onJump && onJump(i)} />
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
        {stories.filter(s => s.points !== null).length} done · {stories.filter(s => s.points === null).length} remaining
      </div>
    </div>
  )
}

/* ── Active story card ── */
function ActiveStoryCard({ story, num, total }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 6 }}>
        STORY {num} OF {total}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4 }}>{story.title}</div>
      {story.desc && <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.5 }}>{story.desc}</div>}
    </div>
  )
}

/* ── Voting cards grid ── */
function VotingCards({ selected, onSelect }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
        YOUR ESTIMATE
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {FIBS.map(v => (
          <div key={v} className={`vcard ${selected === v ? 'selected' : ''}`} onClick={() => onSelect(v)}>
            {v}
          </div>
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

  return (
    <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: outlierName ? 10 : 0 }}>
        {[['AVG', avg], ['SPREAD', `${min}–${max}`], ['MODE', `${mode}`]].map(([k, v]) => (
          <div key={k} className="stat-box">
            <div className="stat-val">{v}</div>
            <div className="stat-label">{k}</div>
          </div>
        ))}
      </div>
      {outlierName && (
        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
          borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#d4b106', marginBottom: 12 }}>
          💬 {outlierName} voted differently — worth a quick discussion before agreeing.
        </div>
      )}
    </div>
  )
}

/* ── Agree score ── */
function AgreeScore({ myVote, simVotes, onAgree }) {
  const allVotes = [myVote, simVotes.p1, simVotes.p2, simVotes.p3].filter(v => typeof v === 'number')
  const freq = {}
  allVotes.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const sorted = [...new Set(allVotes)].sort((a, b) => a - b)
  const suggested = sorted.length ? sorted.reduce((a, b) => (freq[a] || 0) >= (freq[b] || 0) ? a : b) : null
  const [chosen, setChosen] = useState(suggested)
  const [custom, setCustom] = useState('')

  return (
    <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
        SET AGREED SCORE <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(facilitator)</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {sorted.map(v => (
          <div key={v} className="vcard-sm" onClick={() => { setChosen(v); setCustom('') }}
            style={{ cursor: 'pointer', borderColor: chosen === v ? 'var(--accent)' : 'var(--border2)',
              background: chosen === v ? 'var(--accent)' : 'white',
              color: chosen === v ? 'white' : '#0b0f1a', width: 40, height: 56, fontSize: 18 }}>
            {v}
          </div>
        ))}
        <input className="input" placeholder="custom…" value={custom}
          onChange={e => { setCustom(e.target.value); setChosen(null) }}
          style={{ width: 80, padding: '7px 10px', fontSize: 13 }} />
        <button className="btn btn-green"
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
  const toggle = k => setSelected(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const filtered = JIRA_ISSUES.filter(i =>
    !query.trim() ||
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.key.toLowerCase().includes(query.toLowerCase()) ||
    i.desc.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Import from Jira</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Search or JQL (e.g. sprint = active)…"
            value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          {query && <button className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Project: <strong style={{ color: 'var(--muted2)' }}>Team Axon</strong> · {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
        </div>
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No issues match your search.
            </div>
          )}
          {filtered.map(issue => (
            <div key={issue.key} onClick={() => toggle(issue.key)}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 7,
                background: selected.has(issue.key) ? 'rgba(91,124,246,0.08)' : 'var(--s2)',
                border: `1px solid ${selected.has(issue.key) ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.1s' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.has(issue.key) ? 'var(--accent)' : 'var(--border2)'}`,
                background: selected.has(issue.key) ? 'var(--accent)' : 'transparent', flexShrink: 0, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>
                {selected.has(issue.key) ? '✓' : ''}
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{issue.key}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{issue.title}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{issue.desc}</span>
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
              Import {selected.size > 0 ? selected.size : ''} stories
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

  return (
    <div className="modal-bg" onClick={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal" style={{ width: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Add Story</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 5 }}>Title</div>
              <input className="input" placeholder="As a user, I want to…" value={title}
                onChange={e => setTitle(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && title.trim() && (onAdd({ title: title.trim(), desc: desc.trim() }), onClose())} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 5 }}>Description (optional)</div>
              <textarea className="input" rows={3} placeholder="Acceptance criteria, context…"
                value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!title.trim()}
              onClick={() => { onAdd({ title: title.trim(), desc: desc.trim() }); onClose() }}>
              Add Story
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onSwitchToJira}>
            Import from Jira instead →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Top Bar ── */
function TopBar({ roomName, isVoting, onToggleVoting }) {
  return (
    <div className="topbar">
      <div className="topbar-logo">♠ <span>Planning</span></div>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--muted2)' }}>{roomName}</div>
      <Toggle on={isVoting} onChange={onToggleVoting} label={isVoting ? 'Voting' : 'Observing'} />
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>A</div>
        <span style={{ color: 'var(--muted2)' }}>Alex ★</span>
      </div>
    </div>
  )
}

/* ── Bottom bar ── */
function BottomBar({ phase, myVote, simVotes, onReveal, onClear }) {
  const votedCount = [myVote !== null, !!simVotes.p1, !!simVotes.p2, !!simVotes.p3].filter(Boolean).length

  return (
    <div style={{ height: 56, borderTop: '1px solid var(--border)', padding: '0 20px',
      display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', flexShrink: 0 }}>
      {phase === 'voting' && (
        <>
          {myVote !== null && (
            <button className="btn btn-ghost btn-sm" onClick={onClear}>Clear vote</button>
          )}
          <div style={{ flex: 1 }} />
          {votedCount < 4 && (
            <span className="pulse" style={{ fontSize: 13, color: 'var(--muted2)' }}>
              {4 - votedCount} still voting…
            </span>
          )}
          <button className="btn btn-primary" disabled={votedCount === 0} onClick={onReveal} style={{ gap: 6 }}>
            Reveal Votes →
          </button>
        </>
      )}
      {phase === 'revealed' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClear}>↺ Re-vote</button>
        </div>
      )}
    </div>
  )
}

/* ── Room View ── */
function RoomView({ roomName, stories, setStories, startIdx = 0 }) {
  const [currentIdx, setCurrentIdx] = useState(startIdx)
  const [phase, setPhase]           = useState('voting')
  const [myVote, setMyVote]         = useState(null)
  const [simVotes, setSimVotes]     = useState({})
  const [isVoting, setIsVoting]     = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showJira, setShowJira]     = useState(false)
  const simTimers = useRef([])

  useEffect(() => {
    localStorage.setItem(LS_KEY + '_idx', currentIdx)
  }, [currentIdx])

  const clearTimers = () => { simTimers.current.forEach(clearTimeout); simTimers.current = [] }

  useEffect(() => {
    clearTimers()
    if (myVote !== null && phase === 'voting') {
      SIMULATED_PLAYERS.filter(p => p.role === 'voter').forEach(p => {
        const t = setTimeout(() => {
          setSimVotes(sv => ({ ...sv, [p.id]: randomFib() }))
        }, p.delay)
        simTimers.current.push(t)
      })
    }
    return clearTimers
  }, [myVote, phase])

  const handleReveal = () => { clearTimers(); setPhase('revealed') }

  const handleAgree = (score) => {
    setStories(ss => ss.map((s, i) => i === currentIdx
      ? { ...s, points: score, savedMyVote: myVote, savedSimVotes: simVotes }
      : s
    ))
    const next = currentIdx + 1
    if (next < stories.length) {
      setCurrentIdx(next)
      setPhase('voting')
      setMyVote(null)
      setSimVotes({})
    } else {
      setPhase('complete')
    }
  }

  const handleClear = () => {
    clearTimers()
    setMyVote(null)
    setSimVotes({})
    setPhase('voting')
    setStories(ss => ss.map((s, i) => i === currentIdx
      ? { ...s, points: null, savedMyVote: undefined, savedSimVotes: undefined }
      : s
    ))
  }

  const handleJump = (i) => {
    if (i === currentIdx) return
    clearTimers()
    setCurrentIdx(i)
    const target = stories[i]
    if (target.points !== null && target.savedMyVote !== undefined) {
      setMyVote(target.savedMyVote)
      setSimVotes(target.savedSimVotes || {})
      setPhase('revealed')
    } else {
      setPhase('voting')
      setMyVote(null)
      setSimVotes({})
    }
  }

  const allVotes = [myVote, simVotes.p1, simVotes.p2, simVotes.p3]
  const numVotes = allVotes.filter(v => typeof v === 'number')
  const outlier  = numVotes.length > 2 && (Math.max(...numVotes) - Math.min(...numVotes) >= 5)
    ? SIMULATED_PLAYERS.find(p => simVotes[p.id] === Math.max(...numVotes))?.name
    : null
  const currentStory = stories[currentIdx]

  if (phase === 'complete') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 20, padding: 40 }}>
        <div style={{ fontSize: 40 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>All stories pointed!</div>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 20, width: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stories.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < stories.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{s.title}</span>
              <span className="badge badge-green">{s.points}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg"
          onClick={() => { setCurrentIdx(0); setPhase('voting'); setMyVote(null); setSimVotes({}); setStories(ss => ss.map(s => ({ ...s, points: null }))) }}>
          Start New Session
        </button>
      </div>
    )
  }

  return (
    <>
      <TopBar roomName={roomName} isVoting={isVoting} onToggleVoting={setIsVoting} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <StorySidebar stories={stories} currentIdx={currentIdx} isFacilitator
          onAdd={() => setShowAddModal(true)}
          onJump={handleJump} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ActiveStoryCard story={currentStory} num={currentIdx + 1} total={stories.length} />
          <ParticipantsRow
            myVote={isVoting ? myVote : null}
            simVotes={simVotes}
            revealed={phase === 'revealed'} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {phase === 'voting' && isVoting && (
              <VotingCards selected={myVote} onSelect={setMyVote} />
            )}
            {phase === 'revealed' && (
              <div className="fade-up">
                <RevealStats votes={[myVote, simVotes.p1, simVotes.p2, simVotes.p3]} outlierName={outlier} />
                <AgreeScore myVote={myVote} simVotes={simVotes} onAgree={handleAgree} />
              </div>
            )}
          </div>
          <BottomBar phase={phase} myVote={myVote} simVotes={simVotes}
            onReveal={handleReveal} onClear={handleClear} />
        </div>
      </div>

      {showAddModal && (
        <AddStoryModal
          onAdd={({ title, desc }) => setStories(ss => [...ss, { id: Date.now(), title, desc, points: null }])}
          onClose={() => setShowAddModal(false)}
          onSwitchToJira={() => { setShowAddModal(false); setShowJira(true) }} />
      )}
      {showJira && (
        <JiraModal
          onImport={issues => {
            setStories(ss => [...ss, ...issues.map(i => ({
              id: Date.now() + Math.random(), title: i.title, desc: i.desc, points: null
            }))])
            setShowJira(false)
          }}
          onClose={() => setShowJira(false)} />
      )}
    </>
  )
}

/* ── Landing view ── */
function LandingView({ onCreateRoom }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12, letterSpacing: 8, opacity: 0.3 }}>♠ ♥ ♣ ♦</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>Planning Poker</h1>
        <p style={{ fontSize: 15, color: 'var(--muted2)' }}>Estimate stories as a team — fast, focused, async-friendly.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 300 }}>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onCreateRoom}>
          Create Room
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" placeholder="Paste invite link…" style={{ flex: 1 }} />
          <button className="btn btn-ghost">Join</button>
        </div>
      </div>
    </div>
  )
}

/* ── Create room view ── */
function CreateRoomView({ onNext }) {
  const [name, setName] = useState('')

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Create a room</h2>
          <p style={{ fontSize: 14, color: 'var(--muted2)' }}>Give your session a name so your team knows what to join.</p>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 6 }}>Session name</div>
          <input className="input" placeholder="e.g. Sprint #42 Planning" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
            autoFocus />
        </div>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Card scale</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FIBS.map(v => (
              <div key={v} style={{ width: 34, height: 48, borderRadius: 5, border: '1.5px solid var(--border2)',
                background: 'white', color: '#0b0f1a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{v}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Fibonacci — locked for this session</div>
        </div>
        <button className="btn btn-primary btn-lg" disabled={!name.trim()} onClick={() => onNext(name.trim())}>
          Continue →
        </button>
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

  const add = () => {
    if (!newTitle.trim()) return
    setStories(ss => [...ss, { id: Date.now(), title: newTitle.trim(), desc: newDesc.trim(), points: null }])
    setNewTitle('')
    setNewDesc('')
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 420, borderRight: '1px solid var(--border)', padding: 28, display: 'flex',
        flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 6 }}>ROOM</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{roomName}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted2)' }}>Add the stories you want to estimate.</p>
        </div>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder="Story title…" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newTitle.trim() && add()}
            style={{ background: 'var(--s3)' }} />
          <textarea className="input" rows={2} placeholder="Description (optional)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)} style={{ background: 'var(--s3)' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={!newTitle.trim()} onClick={add}>
              Add Story
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJira(true)}>
              ↗ Import from Jira
            </button>
          </div>
        </div>
        <button className="btn btn-green btn-lg" disabled={stories.length === 0}
          onClick={() => onStart(stories)} style={{ marginTop: 'auto' }}>
          Start Session ({stories.length} {stories.length === 1 ? 'story' : 'stories'}) →
        </button>
      </div>
      <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 14 }}>
          STORIES TO ESTIMATE
        </div>
        {stories.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 40, textAlign: 'center' }}>
            No stories yet — add one on the left, or import from Jira.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stories.map((s, i) => (
              <div key={s.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, width: 22, flexShrink: 0 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{s.title}</div>
                  {s.desc && <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{s.desc}</div>}
                </div>
                <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                  fontSize: 14, padding: '2px 4px' }}
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
              id: Date.now() + Math.random(), title: i.title, desc: i.desc, points: null
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
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} } })()
  const [view, setView]         = useState(saved.view || 'landing')
  const [roomName, setRoomName] = useState(saved.roomName || '')
  const [stories, setStories]   = useState(saved.stories || [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ view, roomName, stories }))
  }, [view, roomName, stories])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {view === 'landing' && <LandingView onCreateRoom={() => setView('create')} />}
      {view === 'create'  && <CreateRoomView onNext={name => { setRoomName(name); setView('stories') }} />}
      {view === 'stories' && <AddStoriesView roomName={roomName} onStart={s => { setStories(s); setView('room') }} />}
      {view === 'room'    && (
        <RoomView roomName={roomName} stories={stories} setStories={setStories}
          startIdx={+localStorage.getItem(LS_KEY + '_idx') || 0} />
      )}

      {view !== 'room' && (
        <div style={{ position: 'fixed', bottom: 16, left: 16 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, opacity: 0.5 }}
            onClick={() => {
              setRoomName('Sprint #42 Planning')
              setStories([
                { id: 1, title: 'User profile page redesign',  desc: 'Edit name, avatar and bio',        points: null },
                { id: 2, title: 'Dashboard analytics widget',  desc: 'Show key metrics on homepage',     points: null },
                { id: 3, title: 'Export to CSV',              desc: 'Bulk export from table views',      points: null },
                { id: 4, title: 'Dark mode toggle',           desc: 'System preference + manual override', points: null },
              ])
              setView('room')
            }}>
            Demo →
          </button>
        </div>
      )}
    </div>
  )
}
