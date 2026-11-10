# Sentinel

Sentinel is a limited URL risk-assessment platform combining URL-pattern heuristics, live HTTP header inspection, TLS certificate checks, and unverified community reports. It does not establish that a website is safe or detect all phishing/malware. See [the security audit](docs/security-audit.md) for exact capabilities, storage, capacity and remaining work.

## Features

- **Threat analysis** — URL-pattern signals (HTTP, IP hosts, punycode, length and account-related keywords); no live blocklist
- **Web security assessment** — live HTTP security-header inspection (HSTS, X-Frame-Options, CSP, etc.)
- **Certificate validation** — live TLS certificate chain, expiry, and issuer inspection
- **Collaborative threat intelligence** — unverified community reports with source and timestamp; deduplicated and excluded from scoring
- **Risk score & verdict** — versioned 0–100 heuristic risk index with Lower risk / Elevated risk / High risk / Inconclusive labels; not a probability
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
│   ├── security-tests.mjs      # security regression suite
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
| POST | `/api/feed/report` | Submit a threat report (body: `{ url, type }`; source is server-assigned) |
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

# Full security regression suite
npm test
```

## Security

See [SECURITY.md](SECURITY.md). Copy `.env.example` to `.env` to configure. Run `npm test` for the security regression suite. Deploy behind a TLS-terminating proxy with `TRUST_PROXY=1`, `FORCE_HTTPS=1` and `PUBLIC_HOST` set.

## Scope and result storage

Real HTTP/TLS observations are implemented; reputation is limited to deterministic URL patterns. No live threat-provider, page-content, malware sandbox, vulnerability scan, CT or revocation checks are performed. An incomplete network assessment returns `unknown`. API values `safe`/`suspicious`/`malicious` are legacy score bands, not confirmed safety/threat findings.

SQLite stores origins (not full URL paths/queries), scores, checks, UUIDs and timestamps. Reports publish origins only. Anyone with a scan UUID can retrieve it. Retention is 30 days (hourly cleanup may lag) and at most 10,000 records/table. Existing URL data is scrubbed in a one-time migration; old duplicates/expired records are removed. Back up existing data before deploying. SQLite is not encrypted; use encrypted infrastructure and backups.

The scanner admits 10 jobs/process, with default per-IP limits of 120 requests/minute and 15 scan/report submissions/minute. These are controls, not measured production capacity. See the audit and `node scripts/capacity-tests.mjs` for a local overload test.

## License

Private project — not licensed for public reuse.

## Updating a local checkout and diagnosing GitHub scans

Stop the old server first, then run these from the repository directory:

```bash
git pull --ff-only origin main
npm ci
npm start
```

The production frontend is committed in `public/`. Hard-refresh your browser after restarting. `/api/health` should include `scannerVersion: "heuristic-v2-redirects"`; if missing, an old server is still running. If editing frontend source, run `npm run build` from the root before starting. This installs client build dependencies and rebuilds the served assets.

If GitHub still cannot be assessed:

```bash
npm run diagnose -- https://github.com/
```

This checks the network used by Node.js on your computer. DNS, VPN, firewall/antivirus and proxy-only networks can block the backend even when the browser works. The tool prints classified failures and does not claim an unreachable site lacks HTTPS. It does not change your firewall or DNS. The scanner follows up to three validated HTTP redirects, checks every destination for SSRF, and never treats failed checks as proof of safety.

Result-rendering regression: `npm run test:render --prefix client` (requires client dependencies).
