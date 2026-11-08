# Progress — Sentinel

## Completed slices
- Project scaffold created (docs/, public/, context/, assets/, scripts/).
- Verification oracles written (verify-foundation.mjs, verify-website.mjs, verify-all.mjs) and GATES.md linted clean (`LINT OK`).
- Foundation `.md` files written and verified: PRD.md, DESIGN.md, AGENTS.md, CLAUDE.md, docs/architecture.md, docs/code-standards.md, public/llms.txt, context/progress.md.
- Animated website built: index.html + assets/css/style.css + assets/js/app.js — dark + light themes, glassmorphism buttons/inputs/cards/nav, custom cursor, hero load entrance, canvas globe visual, radial risk gauge, simulated URL scanner with verdict badge and check breakdown, four threat pillars, collaborative threat intelligence feed.
- AGENTS.md and DESIGN.md updated to reflect the animated dark/light glassmorphism scope.
- Backend built and fully verified: server.js (Express 5, ESM), src/store.js (SQLite WAL), src/detector.js (threat analysis + live header fetch + live TLS cert validation), src/routes.js (POST /api/scan, GET /api/scan/:id, GET /api/feed, POST /api/feed/report, GET /api/health). Security headers, rate limiting, restricted CORS, SSRF guard (private addresses rejected), input validation. Server also serves the static frontend (index.html + assets) so app and API share one origin — `npm start` runs the full app.
- Frontend scanner rewired from simulated detection to real `POST /api/scan` with loading state, error handling, and verdict badge rendering (assets/js/app.js).
- All backend gates pass: `node scripts/verify-all-backend.mjs` → `full backend verification passed`.

## Active bugs
- None.

## Next steps
- Review rendered output in a browser at 1440/1024/768/390 widths; fix any visual defects (run `npm start` to serve frontend + API together, or open index.html directly for the static shell).
- If real scanning, CA integration, accounts, or payments are requested, flag as explicit non-goals per PRD.md (out of scope for this slice).

## Debug and review pass (backend + frontend)
- Fixed: whole repo was served by express.static('.') (source, data/sentinel.db); now only /assets, /public and index.html.
- Fixed: SSRF guard (broken regex, IPv6 and DNS-rebinding gaps); private ranges now checked at connect time.
- Fixed: security-header check always failed (`missing` scoped inside try); long-URL signal never fired; self-signed and chain checks were wrong; cert port ignored.
- Fixed: community reports now feed the threat check and score; strict rate limiter was defined but unused; malformed JSON returned 500; report type/source are now validated.
- Fixed: CSP blocked inline styles; feed and certificate panel were static; theme icon showed a literal escape; engines now Node >= 22.
- Next: add automated tests for isPrivateIp, scan(), and the report API; the existing gates did not catch these bugs.
- Completed: removed all demo data (cleared scans + reports from SQLite, deleted data/sentinel.db*; replaced static demo check text with neutral "Not scanned yet" placeholders).
- Completed: changed dark mode background from navy (#0b1120) to AMOLED black (#000000), and re-tuned surface/glass tokens so dark mode reads as pure black without blue cast.

