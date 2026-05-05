const { Router } = require('express')
const db = require('../db')
const { broadcastToRoom } = require('../ws')

const router = Router({ mergeParams: true })

function storyShape(s) {
  return {
    id: s.id,
    title: s.title,
    desc: s.desc,
    points: s.points,
    position: s.position,
    phase: s.phase,
    jiraKey: s.jiraKey ?? null,
    votes: (s.votes || []).map(v => ({ participantId: v.participantId, value: v.value })),
  }
}

async function nextPosition(roomId) {
  const last = await db.story.findFirst({
    where: { roomId },
    orderBy: { position: 'desc' },
  })
  return last ? last.position + 1 : 0
}

// POST /api/rooms/:name/stories
router.post('/', async (req, res) => {
  const { title, desc = '' } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })

  const room = await db.room.findUnique({ where: { name: req.params.name } })
  if (!room) return res.status(404).json({ error: 'Room not found' })

  const position = await nextPosition(room.id)
  const story = await db.story.create({
    data: { roomId: room.id, title, desc, position },
    include: { votes: true },
  })

  broadcastToRoom(room.name, { type: 'story:added', story: storyShape(story) })
  res.json({ story: storyShape(story) })
})

// POST /api/rooms/:name/stories/batch
router.post('/batch', async (req, res) => {
  const items = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'body must be a non-empty array' })
  }

  const room = await db.room.findUnique({ where: { name: req.params.name } })
  if (!room) return res.status(404).json({ error: 'Room not found' })

  let position = await nextPosition(room.id)
  const stories = []
  for (const { title, desc = '', jiraKey = null } of items) {
    if (!title) continue
    const story = await db.story.create({
      data: { roomId: room.id, title, desc, position: position++, ...(jiraKey ? { jiraKey } : {}) },
      include: { votes: true },
    })
    stories.push(storyShape(story))
    broadcastToRoom(room.name, { type: 'story:added', story: storyShape(story) })
  }

  res.json({ stories })
})

module.exports = router
