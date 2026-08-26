const { Router } = require('express')
const { randomUUID } = require('crypto')
const db = require('../db')
const storiesRouter = require('./stories')

const router = Router()

// Serialize a room snapshot (stories + participants) for the client
function roomSnapshot(room) {
  return {
    id: room.id,
    name: room.name,
    stories: room.stories
      .sort((a, b) => a.position - b.position)
      .map(s => ({
        id: s.id,
        title: s.title,
        desc: s.desc,
        points: s.points,
        position: s.position,
        phase: s.phase,
        votes: s.votes.map(v => ({ participantId: v.participantId, value: v.value })),
      })),
    participants: room.participants.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isFacilitator: p.isFacilitator,
    })),
  }
}

const ROOM_INCLUDE = {
  stories: { include: { votes: true } },
  participants: true,
}

// POST /api/rooms — create room + first participant (facilitator)
router.post('/', async (req, res) => {
  const { name, displayName } = req.body
  if (!name || !displayName) {
    return res.status(400).json({ error: 'name and displayName are required' })
  }

  const token = randomUUID()
  const room = await db.room.create({
    data: {
      name,
      participants: {
        create: { name: displayName, token, isFacilitator: true },
      },
    },
    include: ROOM_INCLUDE,
  })

  const participant = room.participants[0]
  res.json({ room: roomSnapshot(room), participant: { id: participant.id, name: participant.name, role: participant.role, isFacilitator: participant.isFacilitator }, token })
})

// GET /api/rooms/:roomId — full room snapshot (no auth needed for read; roomId is the unguessable join secret)
router.get('/:roomId', async (req, res) => {
  const room = await db.room.findUnique({
    where: { id: req.params.roomId },
    include: ROOM_INCLUDE,
  })
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ room: roomSnapshot(room) })
})

// POST /api/rooms/:roomId/join — join an existing room
router.post('/:roomId/join', async (req, res) => {
  const { displayName } = req.body
  if (!displayName) return res.status(400).json({ error: 'displayName is required' })

  const room = await db.room.findUnique({
    where: { id: req.params.roomId },
    include: ROOM_INCLUDE,
  })
  if (!room) return res.status(404).json({ error: 'Room not found' })

  // Reuse existing participant if the name is already taken in this room (case-insensitive).
  // This lets someone rejoin after losing their localStorage identity without creating a duplicate.
  const existing = room.participants.find(
    p => p.name.toLowerCase() === displayName.toLowerCase()
  )

  if (existing) {
    return res.json({
      room: roomSnapshot(room),
      participant: { id: existing.id, name: existing.name, role: existing.role, isFacilitator: existing.isFacilitator },
      token: existing.token,
    })
  }

  const token = randomUUID()
  const participant = await db.participant.create({
    data: { roomId: room.id, name: displayName, token },
  })

  res.json({
    room: roomSnapshot(room),
    participant: { id: participant.id, name: participant.name, role: participant.role, isFacilitator: participant.isFacilitator },
    token,
  })
})

router.use('/:roomId/stories', storiesRouter)

module.exports = router
