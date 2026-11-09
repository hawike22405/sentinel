# Progress — Sentinel

## Completed slices
- Project scaffold created (docs/, public/, context/, assets/, scripts/).
- Verification oracles written (verify-foundation.mjs, verify-website.mjs, verify-all.mjs) and GATES.md linted clean (`LINT OK`).
- Foundation `.md` files written and verified: PRD.md, DESIGN.md, AGENTS.md, CLAUDE.md, docs/architecture.md, docs/code-standards.md, public/llms.txt, context/progress.md.
- Animated website built: index.html + assets/css/style.css + assets/js/app.js — dark + light themes, glassmorphism buttons/inputs/cards/nav, custom cursor, hero load entrance, canvas globe visual, radial risk gauge, simulated URL scanner with verdict badge and check breakdown, four threat pillars, collaborative threat intelligence feed.
- AGENTS.md and DESIGN.md updated to reflect the animated dark/light glassmorphism scope.
- All backend gates pass: `node scripts/verify-all-backend.mjs` → `full verification passed`.
- Backend built and fully verified: server.js (Express 5, ESM), src/store.js (SQLite WAL), src/detector.js (threat analysis + live header fetch + live TLS cert validation), src/routes.js (POST /api/scan, GET /api/scan/:id, GET /api/feed, POST /api/feed/report, GET /api/health). Security headers, rate limiting, restricted CORS, SSRF guard, input validation. Server serves the static frontend (index.html + assets) so app and API share one origin — `npm start` runs the full app.
- Frontend scanner rewired from simulated detection to real `POST /api/scan` with loading state, error handling, and verdict badge rendering (assets/js/app.js).
- Demo data removed (cleared scans + reports from SQLite, deleted data/sentinel.db*; replaced static demo check text with neutral placeholders).
- Dark mode changed to AMOLED black (#000000) with re-tuned surface/glass tokens.
- Globe animation replaced with terminal visual, then with React TextLoop wave ribbon.
- **Security hardening applied** (from sentinel-security-hardening.patch + sentinel-hardened.zip):
  - server.js: security headers (CSP, HSTS, XFO, nosniff, referrer, COOP, CORP), CORS restricted, rate limiting, SSRF guard, content-type validation, body size limits, error handling without stack traces, static file serving restricted to public/
  - src/env.js: .env loading (Node loadEnvFile)
  - src/security-log.js: structured JSON security event logging
  - src/store.js: DB outside web root, owner-only permissions (0700/0600), WAL, migration for reports.host column, ISO-8601 timestamps, deleteReport()
  - src/detector.js: allowed ports (80, 443, 8080, 8443), DNS rebinding protection via publicOnlyLookup, private IP blocking (IPv4/IPv6), credentials stripped from scanned URLs
  - src/routes.js: admin auth with bearer token + constant-time comparison, DELETE /api/admin/reports/:id, UUID validation, concurrent scan limit (10), SSRF logging
  - scripts/security-tests.mjs: 72-check security regression suite
  - .env.example: environment variable documentation
  - package.json: `npm test` script, engines node >=22
- All 72 security tests pass: `npm test` → `security tests passed: 72 passed, 0 failed`
- **Frontend converted to React + Vite** in client/ directory:
  - React 18 + GSAP + Vite
  - TextLoop component (from React Bits) integrated as animated wave ribbon in hero kicker
  - Components: ThemeToggle, CustomCursor, Hero, Pillars, ScanResult, ThreatFeed, Footer, App
  - Builds to public/ (served by Express)
  - `npm run build` (in client/) builds the React frontend

- **CurvedInput (React Bits) integration fixed**:
  - Root causes: Hero.jsx looked up `#scan-btn` (not present in the new component, so submit threw), `type="url"` triggered native browser validation (blocked inputs like `example.com`), and the component was a flat approximation instead of the curved React Bits layout
  - client/src/components/CurvedInput.jsx rewritten: SVG arc surface, text/caret/icon/button label drawn along the curve, transparent native `<input>` for typing, `noValidate` form, responsive via ResizeObserver, theme via CSS tokens (follows the dark/light toggle)
  - Hero.jsx: removed DOM manipulation, uses `disabled` + `buttonText` while scanning
  - Styles live in client/src/App.css under `/* Curved Input */`; public/ rebuilt

## Active bugs
- None.

## Next steps
- Review rendered output in a browser at 1440/1024/768/390 widths; fix any visual defects (run `npm start` to serve frontend + API together, or open public/index.html directly for the static shell).
- Run `npm test` to verify security regression suite passes.
- If real scanning, CA integration, accounts, or payments are requested, flag as explicit non-goals per PRD.md (out of scope for this slice).
- Client dependencies: `cd client && npm install` then `npm run build` to rebuild frontend.
