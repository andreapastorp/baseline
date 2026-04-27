const express = require('express')
const cors = require('cors')
const roomsRouter = require('./routes/rooms')
const storiesRouter = require('./routes/stories')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/rooms', roomsRouter)
app.use('/api/rooms/:name/stories', storiesRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

module.exports = app
