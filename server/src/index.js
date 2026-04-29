require('dotenv').config()
const http = require('http')
const app = require('./app')
const ws = require('./ws')

const PORT = process.env.PORT || 3001
const server = http.createServer(app)

ws.setup(server)

server.listen(PORT, () => {
  const addr = process.env.NODE_ENV === 'production' ? `port ${PORT}` : `http://localhost:${PORT}`
  console.log(`Server running on ${addr}`)
})
