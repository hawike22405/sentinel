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

- **Lightfall (React Bits) added as the page background**:
  - client/src/components/Lightfall.jsx + Lightfall.css (vendored React Bits JS+CSS variant, `'use client'` directive dropped since this is a Vite SPA)
  - client/src/components/PageBackground.jsx: resolves `--color-accent` / `--color-text` at runtime (Lightfall needs color strings), watches `data-theme` so the dark/light toggle updates the effect live; dark = additive light, light = `lightMode`
  - App.jsx mounts it before the nav; App.css `.page-bg` (fixed, z-index 0, pointer-events none) and `main, .footer { position: relative; z-index: 1 }`
  - Settings: opacity 0.5 dark / 0.4 light for text legibility, `holdToWarp` off so pressing the scan input never triggers warp, dpr capped at 1.5
  - AGENTS.md and DESIGN.md allow-lists updated to include it
  - Falls back to the plain themed background when WebGL2 is unavailable; honors prefers-reduced-motion (static frame)

## Active bugs
- None.

## Next steps
- Review rendered output in a browser at 1440/1024/768/390 widths; fix any visual defects (run `npm start` to serve frontend + API together, or open public/index.html directly for the static shell).
- Run `npm test` to verify security regression suite passes.
- If real scanning, CA integration, accounts, or payments are requested, flag as explicit non-goals per PRD.md (out of scope for this slice).
- Client dependencies: `cd client && npm install` then `npm run build` to rebuild frontend.


## Security audit update — 10 November 2026
- Completed: real HTTP/TLS scanner audit, unknown verdict for incomplete evidence, honest risk labels/chart, issuer fix, DNS pinning/reserved-range controls, absolute network deadlines, anonymous-report score isolation/deduplication, origin-only storage migration/retention, patched frontend tooling and rebuilt public assets.
- Validation: npm test (8 detector/storage tests, 76 security assertions, controlled overload fixture); React build; both repository verifiers; backend/client audits reported no known advisories. Browser launch was blocked by environment socket restrictions, so visual verification is pending.
- Active limitations and next steps: docs/security-audit.md is the current capability/capacity/privacy reference. Threat-provider setup, isolated content/malware analysis, CT/revocation checks, accuracy evaluation and actual hosting/load validation remain necessary for the full product statement.


## GitHub scan error follow-up — 10 November 2026
- Screenshot matched old code; main still contained the pre-audit version, with PR #2 open/draft.
- Added three-hop validated redirect handling, DNS/connection error classification, a 15-second scan deadline, local diagnose command, health scanner-version marker, frontend stale-backend guard, HTML revalidation and check-label spacing.
- Real network evidence in this runtime: direct Node DNS unavailable while proxy-backed curl reached GitHub. This is not evidence of the user's local network configuration.
- Validation: detector/storage and HTTP security/overload tests, production build, result SSR rendering, and repository checks. Update local checkout and restart to receive committed frontend/backend changes.


## Animated carousel font — 10 November 2026
- Card headings were isolated SVG image text and could not inherit the page's Great Day font. Verified the uploaded regular/bold font bytes match the existing bundled files.
- Draw headings into the WebGL card texture with the loaded bold --font-display face. Fit script flourishes and add heading/body spacing. Existing lens shaders, dragging, resizing and animation remain unchanged; disposed mounts cannot update textures after font loading.
- Validation: native canvas artwork preview with the supplied bold font, production React build and full frontend repository verifier. Full browser animation was not exercised in this runtime.


## Local startup / stale backend follow-up — 10 November 2026
- Express 5 calls the listen callback on bind errors; the earlier port log dereferenced null before handling the error. Added explicit failure handling, cleanup and a useful EADDRINUSE message.
- Verified with a real occupied-port fixture and a fresh isolated server that the current health/scan API satisfies the frontend version guard. Pulling frontend files without restarting an old API process explains the observed mismatch; the user's exact listener PID has not been inspected.
- Added startup regressions to npm test, clarified the stale-backend UI message and documented starting on port 3001 and opening that exact URL.


## Flame scan buttons — 10 November 2026
- Adapted the supplied component to React JSX and scoped CSS at client/src/components/ui/flame-button.jsx. lucide-react was already installed; no providers, external images or framework migration needed.
- Integrated with navigation (in-page #hero link) and CurvedInput (real submit control, current URL and pending disabled state retained). Added an optional renderButton slot; other CurvedInput callers keep their existing control.
- Pointer-driven CSS variables provide the flare without an idle RAF loop. Preserved keyboard focus, disabled/touch behavior, reduced-motion styling and responsive button sizing. Added editor alias mapping, a non-conflicting demo and optional shadcn/Tailwind/TypeScript setup instructions in docs/flame-button.md.
- Validation: DOM interaction checks for submit URL, disabled state, pointer edge tracking and internal/external navigation; production build, existing result-render tests and full frontend verifier passed. Full visual browser rendering was not exercised in this runtime.
