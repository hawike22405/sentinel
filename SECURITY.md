# Security report: Sentinel

Status of the 27-item hardening checklist. "Verified" means covered by `npm test` (real HTTP against real server instances) or a command named below.

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Authentication | Done where applicable: the scanner is public by design (PRD: no accounts). The one privileged action, report moderation, needs a bearer token. | tests 1/9 |
| 2 | Hide API keys | Nothing to hide: no keys exist in code, config or history. | grep + gitleaks |
| 3 | Lock the database | Done: DB outside web root, dir 0700, files 0600 (incl. WAL), parameterized only. | test 3 |
| 4 | Enforce HTTPS | Done at app level (308 redirect to PUBLIC_HOST, HSTS only on HTTPS). TLS itself must be terminated by a proxy/host. | test 4 |
| 5 | Hash passwords | N/A: there are no passwords. Admin token is compared by SHA-256 digest in constant time. | code review |
| 6 | Server-side validation | Done: type, length, scheme, port, UUID, JSON-only, body size. | test 6 |
| 7 | Block XSS | Done: no HTML sinks in frontend (`textContent` only), strict CSP, URLs percent-encoded. | grep + test 7 |
| 8 | Log suspicious activity | Done: JSON events for SSRF attempts, invalid URLs, bad content-type, bad JSON, oversize bodies, rate limits, admin failures. No secrets logged. | test 8 |
| 9 | Lock admin routes | Done: token auth, 10 req/min, 404 when disabled, weak tokens refused. | test 1/9, 11 |
| 10 | Parameterized queries | Verified: every query uses prepared statements with bound values; injection payload stored inert. | grep + test 10 |
| 11 | Env variables | Done: `.env` loaded first, `.env.example` documented, `.env` git-ignored. | test 11 |
| 12 | Rate limiting | Done: 120/min general, 15/min scan+report, 10/min admin, plus max 10 concurrent scans. | test 12 |
| 13 | Restrict CORS | Done: CORS fully off unless one FRONTEND_ORIGIN is set. | test 13 |
| 14 | Security headers | Done: CSP, XFO, nosniff, referrer, permissions, COOP, CORP, no X-Powered-By, API no-store. | test 14 |
| 15 | Secure cookies | N/A: the app sets no cookies (verified). | test 15 |
| 16 | CSRF protection | Not needed (no cookie auth); POSTs must be `application/json` so cross-site forms cannot submit. | test 16 |
| 17 | Expiring reset links | N/A: no accounts or resets. | n/a |
| 18 | Upload limits | No uploads exist; multipart rejected; JSON body capped at 16 KB. | test 18 |
| 19 | Verify prices | N/A: no payments (PRD non-goal). | n/a |
| 20 | Debug mode off | Done: generic 500s, JSON 404s, no stacks in responses. | test 20 |
| 21 | Update dependencies | All current; `npm audit`: 0 vulnerabilities. | npm audit/outdated |
| 22 | Remove unused packages | All 4 dependencies are used. | import grep |
| 23 | Exposed files | Fixed (repo root was served). 17 paths incl. traversal now 404. | test 23 |
| 24 | Scan Git history | 4 commits + working tree + committed zip: no secrets. | gitleaks 8.18.4 |
| 25 | Revoke leaked keys | Nothing leaked, nothing to revoke. | gitleaks |
| 26 | Full security review | Done; see Open items. | this file |
| 27 | Test + report | `npm test`, this file. | |

## Current audit and limitations

The historical checklist above describes the original hardening work, not certification of the current deployment. For the current detection capabilities, fixes, privacy migration, retention, encryption requirements, dependency checks, capacity fixture, and unresolved production work, see [docs/security-audit.md](docs/security-audit.md).

Anonymous reports no longer influence scores; report duplicates are rejected. Non-global IPv6 transition ranges are blocked, network addresses are pinned, and absolute inspection deadlines are tested. Database records are origin-only and bounded by age/count. SQLite remains unencrypted at rest. Rate limiting is per-process and in memory. Hosting configuration and detection accuracy remain unverified.
