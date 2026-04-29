const express = require('express')
const cors = require('cors')
const path = require('path')
const roomsRouter = require('./routes/rooms')
const storiesRouter = require('./routes/stories')

const app = express()
const isProd = process.env.NODE_ENV === 'production'

if (!isProd) app.use(cors())
app.use(express.json())

app.use('/api/rooms', roomsRouter)
app.use('/api/rooms/:name/stories', storiesRouter)
app.get('/api/health', (_req, res) => res.json({ ok: true }))

if (isProd) {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

module.exports = app
