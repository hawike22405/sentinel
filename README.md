# Sentinel

Sentinel is an intelligent platform that detects phishing and malicious websites by combining threat analysis, web security assessment, certificate validation, and collaborative threat intelligence.

## Features

- **Threat analysis** — reputation signals, look-alike domain detection, credential-harvesting keyword scanning
- **Web security assessment** — live HTTP security-header inspection (HSTS, X-Frame-Options, CSP, etc.)
- **Certificate validation** — live TLS certificate chain, expiry, and issuer inspection
- **Collaborative threat intelligence** — community-submitted threat reports with source and timestamp
- **Risk score & verdict** — 0–100 risk score with Safe / Suspicious / Malicious badge
- **Animated UI** — dark/light themes, glassmorphism components, custom cursor, hero load entrance, animated wave ribbon, Lightfall page background, curved URL input
- **Security hardening** — SSRF protection, rate limiting, CSP headers, input validation, SQLite WAL mode

## Tech stack

- **Frontend:** React 18 + Vite + GSAP (builds to `public/`)
- **Backend:** Node.js + Express 5 (ES modules) — serves API + static frontend
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Security:** Rate limiting, CORS restriction, security headers, SSRF guard, input validation

## Project structure

```
sentinel/
├── index.html                  # HTML entry point (served by backend)
├── package.json                # backend dependencies & scripts
├── server.js                   # Express backend (serves API + static frontend)
├── PRD.md                      # product requirements
├── DESIGN.md                   # visual design system & tokens
├── AGENTS.md                   # cross-agent rules
├── CLAUDE.md                   # persistent tool context
├── GATES.md                    # frontend completion ledger
├── GATES.backend.md            # backend completion ledger
├── PLAN.md / PLAN.backend.md   # project plans
├── public/llms.txt             # documentation index for agents
├── public/assets/              # built frontend assets (CSS, JS, fonts)
├── client/                     # React frontend source
│   ├── index.html              # Vite entry HTML
│   ├── vite.config.js          # Vite configuration
│   ├── package.json            # frontend dependencies
│   ├── src/
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # root component
│   │   ├── App.css             # global styles & design tokens
│   │   ├── components/
│   │   │   ├── App.jsx
│   │   │   ├── CurvedInput.jsx         # curved URL input
│   │   │   ├── Footer.jsx
│   │   │   ├── Hero.jsx            # hero section with scanner
│   │   │   ├── Lightfall.jsx       # animated page background
│   │   │   ├── Lightfall.css       # lightfall styles
│   │   │   ├── Moments.jsx
│   │   │   ├── Pillars.jsx
│   │   │   ├── ScanResult.jsx      # scan result display
│   │   │   ├── TextLoop.jsx        # animated wave ribbon
│   │   │   ├── TextLoop.css        # text loop styles
│   │   │   ├── ThemeToggle.jsx     # dark/light theme toggle
│   │   │   └── ThreatFeed.jsx      # collaborative threat feed
│   └── public/
├── docs/
│   ├── architecture.md         # system boundaries & patterns
│   └── code-standards.md       # reusable patterns & utilities
├── scripts/
│   ├── verify-all-backend.mjs  # full backend verification
│   ├── verify-server.mjs       # server startup + health check
│   ├── verify-scan.mjs         # scan endpoint validation
│   ├── verify-storage.mjs      # storage persistence check
│   ├── verify-deps.mjs         # dependency check
│   ├── verify-foundation.mjs   # foundation files check
│   ├── verify-website.mjs      # website structure check
│   ├── security-tests.mjs      # 72-check security regression suite
│   └── gate-lint.mjs           # gate ledger linter
├── .env.example                # environment variables template
├── .gitignore
└── context/progress.md         # session memory
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/scan` | Scan a URL (body: `{ url }`) |
| GET | `/api/scan/:id` | Get a scan result by ID |
| GET | `/api/feed` | List community threat reports |
| POST | `/api/feed/report` | Submit a threat report (body: `{ url, type, source }`) |
| DELETE | `/api/admin/reports/:id` | Delete a report (requires `ADMIN_TOKEN`) |

## Run locally

### Prerequisites

- Node.js 22+ (required by better-sqlite3 13; tested on Node 22)
- npm

### Install dependencies

```bash
cd sentinel
npm install
```

### Build the frontend

```bash
cd client
npm install
npm run build
cd ..
```

This builds the React frontend into `public/assets/`.

### Start the server

```bash
npm start
```

The server starts on `http://localhost:3000` (or the port in the `PORT` env variable) and serves both the API and the static frontend. Open `http://localhost:3000` in your browser.

### Run without the backend (frontend only)

Open `public/index.html` directly in a browser. The scanner will show its initial state; the live scan requires the backend running.

### Run verification checks

```bash
# Lint the completion ledgers
node scripts/gate-lint.mjs GATES.md
node scripts/gate-lint.mjs GATES.backend.md

# Full backend verification (starts server on a test port)
node scripts/verify-all-backend.mjs

# Full security regression suite (72 checks)
npm test
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