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

  const existing = await db.room.findUnique({ where: { name } })
  if (existing) {
    return res.status(409).json({ error: 'Room name already taken' })
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

// GET /api/rooms/:name — full room snapshot (no auth needed for read)
router.get('/:name', async (req, res) => {
  const room = await db.room.findUnique({
    where: { name: req.params.name },
    include: ROOM_INCLUDE,
  })
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ room: roomSnapshot(room) })
})

// POST /api/rooms/:name/join — join an existing room
router.post('/:name/join', async (req, res) => {
  const { displayName } = req.body
  if (!displayName) return res.status(400).json({ error: 'displayName is required' })

  const room = await db.room.findUnique({
    where: { name: req.params.name },
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

router.use('/:name/stories', storiesRouter)

module.exports = router
