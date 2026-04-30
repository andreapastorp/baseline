# Baseline

A focused and efficient poker planning tool. Every design and product decision should create a productive and clearer estimation session - nothing else.

## Tech

**Frontend:** React 19 + Vite SPA. All UI lives in `src/App.jsx`, styles in `src/index.css`.

**Backend:** Express 5 + WebSocket (`ws`) + Prisma ORM. Dev database is SQLite (`server/prisma/dev.db`).

**Structure:**
```
src/          # React frontend
server/src/   # Express + WS server
server/prisma # Schema + migrations
``` 

**Running locally:**
```
# Terminal 1 — frontend
npm install && npm run dev

# Terminal 2 — backend
cd server && cp .env.example .env && npx prisma migrate dev && npm run dev
```

## How to work
**Working style:** The user describes what they want; Claude implements it. Keep scope tight — build exactly what's described, nothing more.

**UI work:** Before touching any styles or layout, read `.impeccable.md` in the project root. It defines the design language. Follow it strictly. If a UI change conflicts with those principles, flag it.
