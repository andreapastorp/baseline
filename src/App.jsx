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
      {label && <span className="toggle-label">{label}</span>}
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
    <div className="participants">
      <div className="participants-header">
        <span className="label">Participants</span>
        {!revealed
          ? <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{votedCount} / 4 voted</span>
          : <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Votes revealed</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
        {all.map((p, i) => {
          const isMe = p.id === 'me'
          const voted = isMe ? myVote !== null : !!simVotes[p.id]
          const val   = isMe ? myVote : simVotes[p.id]
          return (
            <div key={p.id} className="participant-col"
              style={{ opacity: p.role === 'observer' ? 0.4 : 1 }}>
              {p.role === 'voter'
                ? <PCard voted={voted} value={val} revealed={revealed} delay={i * 120} />
                : <div style={{
                    width: 40, height: 56,
                    border: '1px solid var(--border)',
                    background: 'var(--s2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.06em', color: 'var(--muted)',
                    textTransform: 'uppercase',
                  }}>obs</div>
              }
              <span className={`participant-name ${isMe ? 'is-me' : ''}`}>
                {p.name}{p.fac ? ' ★' : ''}
              </span>
            </div>
          )
        })}
        {!revealed && (
          <div className="vote-dots" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {[myVote !== null, !!simVotes.p1, !!simVotes.p2, !!simVotes.p3].map((v, i) => (
              <div key={i} className={`vote-dot ${v ? 'voted' : 'waiting'}`} />
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
      <span className="story-row-num">{story.num}</span>
      <span className="story-title">{story.title}</span>
      {story.points !== null
        ? <span className="story-pts">{story.points}</span>
        : active
          ? <span className="story-arrow">▶</span>
          : null}
    </div>
  )
}

/* ── Story sidebar ── */
function StorySidebar({ stories, currentIdx, isFacilitator, onAdd, onJump }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="label">Stories</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="sidebar-progress">{currentIdx + 1}/{stories.length}</span>
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
      <span className="label">Your Estimate</span>
      <div className="vote-grid">
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
    <div className="reveal-section">
      <div className="stat-row">
        <div>
          <div className="stat-val primary">{avg}</div>
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
function AgreeScore({ myVote, simVotes, onAgree }) {
  const allVotes = [myVote, simVotes.p1, simVotes.p2, simVotes.p3].filter(v => typeof v === 'number')
  const freq = {}
  allVotes.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const sorted = [...new Set(allVotes)].sort((a, b) => a - b)
  const suggested = sorted.length ? sorted.reduce((a, b) => (freq[a] || 0) >= (freq[b] || 0) ? a : b) : null
  const [chosen, setChosen] = useState(suggested)
  const [custom, setCustom] = useState('')

  return (
    <div className="agree-section">
      <span className="label">Set Agreed Score</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>facilitator</span>
      <div className="agree-row">
        {sorted.map(v => (
          <div key={v} className={`vcard-sm ${chosen === v ? 'chosen' : ''}`}
            onClick={() => { setChosen(v); setCustom('') }}>
            {v}
          </div>
        ))}
        <input className="input" placeholder="custom…" value={custom}
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
          <div className="modal-title">Import from Jira</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
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
              onClick={() => toggle(issue.key)}>
              <div className="jira-checkbox">{selected.has(issue.key) ? '✓' : ''}</div>
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

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">Add Story</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
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

/* ── Top Bar ── */
function TopBar({ roomName, isVoting, onToggleVoting }) {
  return (
    <div className="topbar">
      <div className="topbar-room">{roomName}</div>
      <Toggle on={isVoting} onChange={onToggleVoting} label={isVoting ? 'Voting' : 'Observing'} />
      <div className="divider" />
      <div className="user-chip">
        <div className="user-avatar">A</div>
        <span>Alex ★</span>
      </div>
    </div>
  )
}

/* ── Bottom bar ── */
function BottomBar({ phase, myVote, simVotes, onReveal, onClear }) {
  const votedCount = [myVote !== null, !!simVotes.p1, !!simVotes.p2, !!simVotes.p3].filter(Boolean).length

  return (
    <div className="bottombar">
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
          <button className="btn btn-primary btn-lg" disabled={votedCount === 0} onClick={onReveal}>
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
      <div className="complete-view">
        <div style={{ textAlign: 'center' }}>
          <div className="complete-count">{stories.length}</div>
          <div className="complete-count-label">Stories estimated</div>
        </div>
        <div className="complete-table">
          {stories.map((s, i) => (
            <div key={s.id} className="complete-row">
              <span className="complete-row-title">{s.title}</span>
              <span className="badge badge-green">{s.points}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg"
          onClick={() => {
            setCurrentIdx(0); setPhase('voting'); setMyVote(null); setSimVotes({})
            setStories(ss => ss.map(s => ({ ...s, points: null })))
          }}>
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
            {phase === 'voting' && !isVoting && (
              <div style={{ padding: '24px 24px', color: 'var(--muted)', fontSize: 13 }}>
                Observing this round.
              </div>
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
    <div className="landing">
      <div className="landing-inner">
        <h1 className="landing-heading">Planning<br /><em>Poker</em></h1>
        <p className="landing-sub">Estimate stories as a team — focused, structured, decisive.</p>
        <div className="landing-actions">
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onCreateRoom}>
            Create Session
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Paste invite link…" style={{ flex: 1 }} />
            <button className="btn btn-ghost">Join</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Create room view ── */
function CreateRoomView({ onNext }) {
  const [name, setName] = useState('')

  return (
    <div className="form-view">
      <div className="form-inner">
        <div>
          <div className="form-heading">New Session</div>
          <p className="form-sub">Give this session a name so your team knows what to join.</p>
        </div>
        <div>
          <label className="field-label">Session name</label>
          <input className="input" placeholder="e.g. Sprint 42 Planning" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
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
            onKeyDown={e => e.key === 'Enter' && newTitle.trim() && add()} />
          <textarea className="input" rows={2} placeholder="Description (optional)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={!newTitle.trim()} onClick={add}>
              Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJira(true)}>
              Import from Jira
            </button>
          </div>
        </div>
        <button className="btn btn-green btn-lg" disabled={stories.length === 0}
          onClick={() => onStart(stories)} style={{ marginTop: 'auto' }}>
          Start Session ({stories.length} {stories.length === 1 ? 'story' : 'stories'}) →
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
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, opacity: 0.45 }}
            onClick={() => {
              setRoomName('Sprint 42 Planning')
              setStories([
                { id: 1, title: 'User profile page redesign',  desc: 'Edit name, avatar and bio',           points: null },
                { id: 2, title: 'Dashboard analytics widget',  desc: 'Show key metrics on homepage',        points: null },
                { id: 3, title: 'Export to CSV',              desc: 'Bulk export from table views',         points: null },
                { id: 4, title: 'Dark mode toggle',           desc: 'System preference + manual override',  points: null },
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
