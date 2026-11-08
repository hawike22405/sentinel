# Gates: Sentinel Backend

OWNS: package.json, package-lock.json, server.js, src/**

Scope: Ship a Node.js/Express backend for Sentinel with real detection (threat analysis, live web security assessment, live certificate validation, collaborative threat intelligence), a REST API, SQLite storage, input validation, rate limiting, and security headers. Every outcome has a deterministic check.

- [x] G0: this ledger states outcomes that can fail
  CHECK: node scripts/gate-lint.mjs GATES.backend.md
  EXPECT: LINT OK
  EVIDENCE: gate-lint.mjs printed `LINT OK` (exit 0)

- [x] G1: dependencies install reproducibly (npm ci succeeds, node_modules present)
  CHECK: node scripts/verify-deps.mjs
  EXPECT: dependencies verification passed
  EVIDENCE: verify-deps.mjs: package.json, package-lock.json, node_modules, express, better-sqlite3, express-rate-limit, cors all present; `dependencies verification passed` (exit 0)

- [x] G2: server starts, health endpoint responds, and static frontend is served from the same origin
  CHECK: node scripts/verify-server.mjs
  EXPECT: server verification passed
  EVIDENCE: verify-server.mjs: server starts on test port; /api/health returns 200 { ok: true }; GET / returns index.html (same origin so fetch('/api/scan') works); `server verification passed` (exit 0)

- [x] G3: scan endpoint validates input and returns a risk score + verdict
  CHECK: node scripts/verify-scan.mjs
  EXPECT: scan verification passed
  EVIDENCE: verify-scan.mjs: empty body -> 422, private URL -> 422 (SSRF guard), valid URL -> 200 with id/url/score/verdict/checks (real TLS cert + header inspection); `scan verification passed` (exit 0)

- [x] G4: storage persists scans and reports (write then read back)
  CHECK: node scripts/verify-storage.mjs
  EXPECT: storage verification passed
  EVIDENCE: verify-storage.mjs: POST /api/feed/report returns 201, GET /api/feed contains the report; `storage verification passed` (exit 0)

- [x] G5: full backend verification is clean (deps + server + scan + storage)
  CHECK: node scripts/verify-all-backend.mjs
  EXPECT: full backend verification passed
  EVIDENCE: verify-all-backend.mjs: lint + deps + server + scan + storage all clean; `full backend verification passed` (exit 0)
