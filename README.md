# Sentinel

Sentinel is an intelligent platform that detects phishing and malicious websites by combining threat analysis, web security assessment, certificate validation, and collaborative threat intelligence.

## Features

- **Threat analysis** — reputation signals, look-alike domain detection, credential-harvesting keyword scanning
- **Web security assessment** — live HTTP security-header inspection (HSTS, X-Frame-Options, CSP, etc.)
- **Certificate validation** — live TLS certificate chain, expiry, and issuer inspection
- **Collaborative threat intelligence** — community-submitted threat reports with source and timestamp
- **Risk score & verdict** — 0–100 risk score with Safe / Suspicious / Malicious badge
- **Animated UI** — dark/light themes, glassmorphism components, custom cursor, hero load entrance, canvas threat globe

## Tech stack

- Frontend: vanilla HTML/CSS/JS (no build step)
- Backend: Node.js + Express 5 (ES modules)
- Database: SQLite (better-sqlite3, WAL mode)

## Project structure

```
sentinel/
├── index.html             # animated frontend (served by the backend)
├── assets/css/style.css   # design tokens + glassmorphism components
├── assets/js/app.js       # frontend interactions + scanner API calls
├── server.js              # Express backend (serves API + static frontend)
├── src/
│   ├── store.js           # SQLite storage layer
│   ├── detector.js        # detection engine (headers, TLS cert, heuristics)
│   └── routes.js          # REST API routes
├── scripts/               # verification oracles (gate checks)
├── package.json
├── PRD.md                 # product requirements
├── DESIGN.md              # visual design system & tokens
├── AGENTS.md              # cross-agent rules
├── CLAUDE.md              # persistent tool context
├── GATES.md               # frontend completion ledger
├── GATES.backend.md       # backend completion ledger
├── PLAN.md / PLAN.backend.md
└── context/progress.md    # session memory
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/scan` | Scan a URL (body: `{ url }`) |
| GET | `/api/scan/:id` | Get a scan result by ID |
| GET | `/api/feed` | List community threat reports |
| POST | `/api/feed/report` | Submit a threat report (body: `{ url, type, source }`) |

## Run locally

### Prerequisites

- Node.js 22+ (required by better-sqlite3 13; tested on Node 22)
- npm

### Install dependencies

```bash
cd sentinel
npm install
```

### Start the server

```bash
npm start
```

The server starts on `http://localhost:3000` (or the port in the `PORT` env variable) and serves both the API and the static frontend. Open `http://localhost:3000` in your browser.

### Run without the backend (frontend only)

Open `index.html` directly in a browser. The scanner will show its initial state; the live scan requires the backend running.

### Run verification checks

```bash
# Lint the completion ledgers
node scripts/gate-lint.mjs GATES.md
node scripts/gate-lint.mjs GATES.backend.md

# Full backend verification (starts server on a test port)
node scripts/verify-all-backend.mjs
```

## Security

See [SECURITY.md](SECURITY.md). Copy `.env.example` to `.env` to configure. Run `npm test` for the security regression suite. Deploy behind a TLS-terminating proxy with `TRUST_PROXY=1`, `FORCE_HTTPS=1` and `PUBLIC_HOST` set.

## Scope (this slice)

This is the presentation layer plus a verification-harness backend. Detection in this slice is a simulated/deterministic engine, not a live network scanner. The following are explicit non-goals:

- Real-time network scanning or blocking
- Live certificate-authority integration
- User accounts, authentication, or payments
- Multi-tenancy

## License

Private project — not licensed for public reuse.
