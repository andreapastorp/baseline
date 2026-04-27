require('dotenv').config()
const http = require('http')
const app = require('./app')
const ws = require('./ws')

const PORT = process.env.PORT || 3001
const server = http.createServer(app)

ws.setup(server)

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
