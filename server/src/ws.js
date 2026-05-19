const { WebSocketServer } = require('ws')
const { parse } = require('url')
const db = require('./db')

// roomName → Set<WebSocket>
const rooms = new Map()

// ws → { participantId, roomName, isFacilitator }
const clients = new Map()

// participantId → Set<WebSocket> (all active connections for this participant)
const participantConnections = new Map()

// roomName → storyId (facilitator's current story, ephemeral)
const facilitatorFocus = new Map()

function broadcastToRoom(roomName, message, exclude = null) {
  const sockets = rooms.get(roomName)
  if (!sockets) return
  const data = JSON.stringify(message)
  for (const ws of sockets) {
    if (ws !== exclude && ws.readyState === 1 /* OPEN */) {
      ws.send(data)
    }
  }
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message))
}

function storyShape(s) {
  return {
    id: s.id,
    title: s.title,
    desc: s.desc,
    points: s.points,
    position: s.position,
    phase: s.phase,
    // Only expose vote values once the story is revealed/agreed — preserve ballot secrecy
    votes: (s.votes || []).map(v => ({
      participantId: v.participantId,
      participantName: v.participant?.name ?? null,
      ...(s.phase !== 'voting' ? { value: v.value } : { hasVoted: true }),
    })),
  }
}

async function getRoomSnapshot(roomName, connectedParticipantIds) {
  const room = await db.room.findUnique({
    where: { name: roomName },
    include: {
      stories: { include: { votes: { include: { participant: true } } } },
      participants: true,
    },
  })
  if (!room) return null
  return {
    id: room.id,
    name: room.name,
    facilitatorStoryId: facilitatorFocus.get(roomName) ?? null,
    stories: room.stories
      .sort((a, b) => a.position - b.position)
      .map(storyShape),
    participants: room.participants
      .filter(p => connectedParticipantIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isFacilitator: p.isFacilitator,
      })),
  }
}

function setup(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Keep connections alive through proxy idle timeouts
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) { ws.terminate(); return }
      ws.isAlive = false
      ws.ping()
    })
  }, 25000)
  wss.on('close', () => clearInterval(heartbeat))

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    const { query } = parse(req.url, true)
    const { room: roomName, token } = query

    if (!roomName || !token) {
      ws.close(4001, 'room and token required')
      return
    }

    // Validate token
    const participant = await db.participant.findUnique({
      where: { token },
      include: { room: true },
    })

    if (!participant || participant.room.name !== roomName) {
      ws.close(4003, 'invalid token')
      return
    }

    // Register client
    if (!rooms.has(roomName)) rooms.set(roomName, new Set())
    rooms.get(roomName).add(ws)
    clients.set(ws, { participantId: participant.id, roomName, isFacilitator: participant.isFacilitator })

    // Track per-participant connections to distinguish "first connection" from "additional tab"
    if (!participantConnections.has(participant.id)) participantConnections.set(participant.id, new Set())
    const pConns = participantConnections.get(participant.id)
    const wasOffline = pConns.size === 0
    pConns.add(ws)

    // Build set of currently-connected participant IDs (including the one just added)
    const connectedIds = new Set()
    for (const sock of rooms.get(roomName)) {
      const info = clients.get(sock)
      if (info) connectedIds.add(info.participantId)
    }

    // Send full room state with only online participants
    const snapshot = await getRoomSnapshot(roomName, connectedIds)
    send(ws, { type: 'room:state', room: snapshot })

    // Only announce join when transitioning from offline → online (not for extra tabs or reconnects
    // where the old socket hasn't closed yet)
    if (wasOffline) {
      broadcastToRoom(roomName, {
        type: 'participant:joined',
        participant: { id: participant.id, name: participant.name, role: participant.role, isFacilitator: participant.isFacilitator },
      }, ws)
    }

    ws.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      const { participantId, roomName } = clients.get(ws) || {}
      if (!participantId) return

      const p = await db.participant.findUnique({ where: { id: participantId } })
      if (!p) return

      switch (msg.type) {
        case 'vote': {
          const { storyId, value } = msg
          if (p.role === 'observer') return
          if (!storyId || value === undefined) return

          if (value === null) {
            // Clear vote
            await db.vote.deleteMany({ where: { storyId, participantId } })
            broadcastToRoom(roomName, { type: 'vote:cast', storyId, participantId, hasVoted: false }, ws)
            send(ws, { type: 'vote:cast', storyId, participantId, hasVoted: false })
          } else {
            // Upsert vote
            await db.vote.upsert({
              where: { storyId_participantId: { storyId, participantId } },
              update: { value: String(value) },
              create: { storyId, participantId, value: String(value) },
            })
            // Broadcast that this participant has voted (value hidden)
            broadcastToRoom(roomName, { type: 'vote:cast', storyId, participantId, hasVoted: true }, ws)
            // Echo back to voter
            send(ws, { type: 'vote:cast', storyId, participantId, hasVoted: true })
          }
          break
        }

        case 'reveal': {
          if (!p.isFacilitator) return
          const { storyId } = msg
          if (!storyId) return

          await db.story.update({ where: { id: storyId }, data: { phase: 'revealed' } })

          const votes = await db.vote.findMany({
            where: { storyId },
            include: { participant: true },
          })

          broadcastToRoom(roomName, {
            type: 'vote:reveal',
            storyId,
            votes: votes.map(v => ({ participantId: v.participantId, participantName: v.participant.name, value: v.value })),
          })
          break
        }

        case 'agree': {
          if (!p.isFacilitator) return
          const { storyId, score } = msg
          if (!storyId || score === undefined) return

          await db.story.update({
            where: { id: storyId },
            data: { points: String(score), phase: 'agreed' },
          })

          // Find next story
          const current = await db.story.findUnique({ where: { id: storyId } })
          const next = await db.story.findFirst({
            where: { roomId: current.roomId, position: { gt: current.position }, points: null },
            orderBy: { position: 'asc' },
          })

          if (next) facilitatorFocus.set(roomName, next.id)

          broadcastToRoom(roomName, {
            type: 'story:agreed',
            storyId,
            score: String(score),
            nextStoryId: next ? next.id : null,
          })
          break
        }

        case 'reset': {
          if (!p.isFacilitator) return
          const { storyId } = msg
          if (!storyId) return

          await db.vote.deleteMany({ where: { storyId } })
          await db.story.update({ where: { id: storyId }, data: { phase: 'voting', points: null } })

          broadcastToRoom(roomName, { type: 'story:reset', storyId })
          break
        }

        case 'observer:toggle': {
          const { role } = msg
          if (role !== 'voter' && role !== 'observer') return

          await db.participant.update({ where: { id: participantId }, data: { role } })

          broadcastToRoom(roomName, { type: 'observer:toggled', participantId, role })
          break
        }

        case 'story:reorder': {
          if (!p.isFacilitator) return
          const { storyIds } = msg
          if (!Array.isArray(storyIds) || storyIds.length === 0) return

          await db.$transaction(storyIds.map((id, i) =>
            db.story.update({ where: { id }, data: { position: i } })
          ))

          broadcastToRoom(roomName, { type: 'story:reorder', storyIds }, ws)
          break
        }

        case 'facilitator:focus': {
          if (!p.isFacilitator) return
          const { storyId } = msg
          if (!storyId) return
          facilitatorFocus.set(roomName, storyId)
          broadcastToRoom(roomName, { type: 'facilitator:focus', storyId }, ws)
          break
        }
      }
    })

    ws.on('close', () => {
      const info = clients.get(ws)
      if (info) {
        const { participantId, roomName, isFacilitator } = info
        clients.delete(ws)

        const sockets = rooms.get(roomName)
        if (sockets) {
          sockets.delete(ws)
          if (sockets.size === 0) rooms.delete(roomName)
        }

        // Only announce departure when this was the participant's last connection
        const pConns = participantConnections.get(participantId)
        if (pConns) {
          pConns.delete(ws)
          if (pConns.size === 0) {
            participantConnections.delete(participantId)
            if (isFacilitator) {
              facilitatorFocus.delete(roomName)
              broadcastToRoom(roomName, { type: 'facilitator:focus', storyId: null })
            }
            broadcastToRoom(roomName, { type: 'participant:left', participantId })
          }
        }
      }
    })
  })
}

module.exports = { setup, broadcastToRoom }
