# Multiplayer Tic-Tac-Toe AI

Full-stack multiplayer Tic-Tac-Toe with **React + TypeScript**, **Node.js + Socket.IO**, **Minimax + Alpha-Beta Pruning**, Redis room state and cross-instance Socket.IO events, PostgreSQL match history, Docker Compose, and a 100-client connection smoke test.

## Features

- Server-issued signed guest JWTs
- Player-vs-player and player-vs-AI modes
- Create room, join with a six-character code, and reconnect to the last room
- Server-authoritative turns, legal move checks, win/draw detection
- Minimax + Alpha-Beta AI runs on the server
- Redis shared room state, short-lived per-room distributed locks, Socket.IO Redis adapter
- PostgreSQL completed-match history
- Responsive browser UI
- Unit tests for game rules and AI decisions
- Docker Compose deployment baseline

## Run with Docker

1. Install Docker Desktop / Docker Engine with Compose.
2. Copy `.env.example` to `.env`; change `JWT_SECRET` and `POSTGRES_PASSWORD` before any public deployment.
3. Run from this directory:

```bash
docker compose up --build
```

4. Open **http://localhost:8080**. For PvP, open a second browser/device, create a PvP room in one, and join its code in the other. For AI, select Player vs Minimax AI and create a room.

The API is exposed on `http://localhost:3001`; Redis and PostgreSQL are internal services.

## Run locally without Docker

Requires Node.js 20+, PostgreSQL, and Redis.

1. Create a database and apply `server/src/schema.sql`.
2. Copy `.env.example` to `.env`; for local Node processes use `DATABASE_URL=postgres://game:password@localhost:5432/tictactoe`, `REDIS_URL=redis://localhost:6379`, and `CLIENT_ORIGIN=http://localhost:5173`.
3. Install dependencies and start both apps:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`; API: `http://localhost:3001`.

## Gameplay

- On first visit, the API issues a signed guest token and the browser keeps it in local storage for reconnection.
- Choose a mode and create a room. Share the room code for PvP.
- The server checks the player identity, turn, cell range, cell occupancy, and game status for every move.
- The AI's move is selected by server-side Minimax with Alpha-Beta Pruning; clients cannot submit an AI move as their own.
- Reloading the same browser reuses its guest identity and attempts to reconnect to the last room.

PvP rooms keep player slots on disconnect. This starter does not include registered accounts, matchmaking, spectators, ranked play, room-expiry cleanup, or rate limiting.

## Architecture

```text
React + TypeScript
  | REST guest token + Socket.IO
Node.js + Express + Socket.IO
  |-- Redis: active room state + per-room lock
  |-- Socket.IO Redis adapter: room events across server instances
  |-- PostgreSQL: completed match history
```

Redis is the shared source for active room state. A short-lived per-room lock prevents simultaneous move requests from overwriting each other's state. The Socket.IO Redis adapter forwards events across backend instances. PostgreSQL stores finished matches rather than every move. Redis Pub/Sub is not used as durable storage; the current game state is kept in Redis with a 12-hour TTL.

## Tests

```bash
npm test
```

Tests cover winner detection, draw detection, Minimax winning/blocking moves, and move validation.

## Load test: 100 concurrent connections

With the API running and reachable, run:

```bash
npm run loadtest -w server
```

Configurable environment variables:

```bash
TARGET_URL=http://localhost:3001 CLIENTS=100 DURATION_SECONDS=30 npm run loadtest -w server
```

The script obtains a guest JWT and opens a WebSocket-only Socket.IO connection for each client, creates up to ten AI rooms, reports connection latency percentiles, and holds the connections for the configured period. It is a **connection-capacity smoke test**, not a complete match-workload benchmark. For a stronger test, extend it with paired PvP clients and repeated valid moves, then record move-event latency and server resource use.

Suggested progression: 25 users for 2 minutes, 50 for 5 minutes, then 100 for 10–15 minutes. Monitor CPU, memory, event-loop delay, Redis latency, PostgreSQL connections, error rate, and p95/p99 event latency. Capacity depends on the host and workload; passing this test is evidence for this tested setup, not a universal guarantee.

## Production checklist

- Use HTTPS/WSS and strong, unique secrets.
- Restrict CORS to the actual frontend origin.
- Add rate limiting to guest issuance and room operations.
- Configure Redis/PostgreSQL persistence, backups, network isolation, and connection limits.
- Configure health checks and logs; set a public HTTPS `VITE_API_URL` at frontend build time.
- If running multiple backend replicas, use the same Redis and JWT secret for all replicas and a WebSocket-compatible load balancer. Consider sticky sessions if polling transport is enabled; this client prefers WebSocket transport.
- Add room cleanup/expiry policies and retry-safe match-history persistence before public launch.
