# Sentinel Backend — Plan & Scope Inventory

## Scope
Build a Node.js/Express backend for Sentinel that powers real detection: threat analysis, web security assessment (live HTTP header fetch), certificate validation (live TLS inspection), and collaborative threat intelligence (community reports). Exposes a REST API consumed by the frontend.

## Independently required outcomes (each gets a gate in GATES.backend.md)

1. `package.json` + dependencies installed (express, better-sqlite3, express-rate-limit, cors) — reproducible `npm ci`.
2. `server.js` — Express app: security headers, restricted CORS, rate limiting, JSON body parsing, route mounting, graceful error handling.
3. `src/store.js` — SQLite storage layer (better-sqlite3): `scans` and `reports` tables, prepared statements, WAL mode, init on startup.
4. `src/detector.js` — detection engine: threat analysis, real web security assessment via `http`/`https` header fetch, real certificate validation via `tls`, threat intelligence lookups.
5. `src/routes.js` — REST API: `POST /api/scan`, `GET /api/scan/:id`, `GET /api/feed`, `POST /api/feed/report`, `GET /api/health`.
6. Input validation — URL schema validation, malformed input rejected with 422, no raw user data in error messages.
7. Server starts and `/api/health` responds `{ ok: true }`.

## Non-goals
- No user accounts, authentication, or payments (explicit non-goals per PRD.md).
- No real-time blocking at network level.
- No third-party threat feeds (collaborative = user-reported only in this slice).
