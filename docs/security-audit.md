# Sentinel security and detection audit

Reviewed 10 November 2026 against the repository code, with local fixture tests. This is not a penetration-test certificate, a production deployment audit, or a measured detection-accuracy benchmark.

## Can users trust the result?

Sentinel performs real outbound HTTP and TLS observations. Its score is a deterministic heuristic index, not an AI prediction, probability of compromise, or assurance that a site is safe. There is no labelled evaluation dataset, so phishing/malware precision, recall, false-positive rate and false-negative rate are unknown. Do not use a low score as permission to enter credentials, send money, or download files.

Previously, DNS/network failures could yield Safe, arbitrary UI values appeared to be measured safety percentages, the issuer display was hardcoded, and anonymous reports could manufacture a malicious verdict. These are fixed. Incomplete observations now produce `unknown` / Inconclusive. Legacy API verdict values `safe`, `suspicious`, `malicious` remain for compatibility but the UI calls these Lower risk, Elevated risk and High risk; they do not establish confirmed maliciousness. The score is versioned `heuristic-v2` with its component weights returned by the API.

## Feature-to-implementation mapping

| Feature | Actual implementation | Limit |
| --- | --- | --- |
| URL threat analysis | HTTP vs HTTPS, IP hosts, hyphens, punycode, length, keyword and subdomain heuristics | Weak signals; legitimate login URLs and international domains can trigger them. No trained model, brand similarity, WHOIS/domain age, or reputation-provider lookup. |
| Website security assessment | Live GET, capped response headers, status and presence of six security headers | No response body, JavaScript, forms, credential harvesting, application vulnerabilities, exposed ports or verified software version checks. Header values/policy effectiveness are not evaluated. |
| Redirects | Recognised 3xx response; not followed; result Inconclusive | Destination and any later chain are unassessed. This avoids treating a redirector as the destination or following internal-network redirects. |
| TLS certificate | Requested HTTPS port, hostname identity, Node/OpenSSL trust chain, validity dates, issuer, fingerprint, available leaf key size and negotiated protocol | No OCSP/CRL revocation, certificate transparency inclusion proof, CA key-generation/entropy audit, compromised-CA detection, full chain cryptographic-strength audit or exhaustive protocol/cipher enumeration. HTTP does not silently probe an unrelated 443 service. |
| Collaborative intelligence | Timestamped local anonymous reports, one per hostname/type, delete moderation protected by admin token | Unverified, not an external intelligence network or corroborated evidence. Cannot change score; no Sybil-resistant identity or report approval workflow. |
| Malware/phishing protection | Risk hints and community warnings | Does not download, execute, disinfect, block navigation, or protect an endpoint. No antivirus engine or sandbox. New or convincing phishing can be missed entirely. |

Cryptographic certificate failures like a CA's defective key generation cannot be inferred from ordinary HTTPS and issuer checks. Nothing here claims to detect or mitigate a specific CA incident.

## Scoring and terminology

URL-pattern weights: HTTP +30, IP host +25, hyphen +15, punycode +15, length over 75 +10, each matching keyword +10, four or more subdomain separators +10. URL subtotal capped at 100. Missing at least three of six headers adds 15 only on a successful HTTP response; an observed invalid certificate adds 15. Total capped at 100. Thresholds are 0–33, 34–66, 67–100. They are engineering choices and have not been calibrated against labelled threats. Anonymous reports add zero.

A failed HTTP inspection, non-2xx response, redirect, or incomplete HTTPS certificate inspection gives Inconclusive regardless of score. Missing security headers alone do not prove phishing. A valid HTTPS certificate alone does not prove a business or page is legitimate. Certificate expiry under 30 days is a warning; short-lived certificates can be legitimate.

Appropriate product wording: “URL risk assessment”, “HTTP header presence”, “TLS hostname and trust-chain checks”, “unverified community reports”. Avoid “Verified Safe”, “malware protection”, “known-bad database checks”, “exposed-service scanning”, “certificate transparency validation”, “cryptographic integrity verification” or “AI detection” unless those capabilities are implemented and validated. UI copy, chart, loading text, footer and README have been corrected. This is a technical wording review, not a review of legal terms of service.

## Storage, privacy and encryption

`src/store.js` stores scan UUID, website origin, heuristic score, verdict, timestamp and JSON checks/reasons in SQLite. Reports store UUID, origin, hostname, category, source and timestamp. Scanned pages, downloaded files and credentials are not stored. Full submitted URLs are contacted transiently, but paths, queries, fragments and userinfo are not published or persisted. URL credentials are rejected. Security logs redact URLs to origins; IPs and security events still go to stderr and require a hosting log-retention policy.

The DB is `SENTINEL_DATA_DIR/sentinel.db` (default `data/sentinel.db`), outside the static web root, directory 0700/files 0600 with prepared SQL statements and WAL. Anyone possessing a scan UUID can retrieve its result: there are no accounts or private result ACLs. Reports are public. Never describe the store as encrypted or private to an account.

New and existing stored URLs are reduced to origins. The one-time migration removes duplicate host/type reports and vacuums old pages, and a regression inspects DB bytes for legacy path/query secrets. Existing external backups, old deployment copies and external logs are not scrubbed by this migration. Retention deletes records older than 30 days and caps each table at 10,000 rows, on startup/writes and hourly (idle age cleanup can lag by up to an hour). Make a restricted backup before deployment; some old IDs/reports will intentionally expire or deduplicate. Origin-only reports trade exact-path intelligence for privacy.

HTTPS is needed between browser and Sentinel; configure TLS at the hosting proxy, `FORCE_HTTPS=1`, `PUBLIC_HOST`, and `TRUST_PROXY=1` only when exactly one trusted proxy is the sole ingress. Direct access to the application must be blocked when trusting that proxy. Default local HTTP is not encrypted. SQLite is not encrypted at rest: use encrypted disks/volumes and encrypted backups with separate key management. If storing sensitive per-user history later, add authentication, ownership/ACL checks, deletion/export policies and managed database/field encryption as appropriate. Do not implement custom cryptography. Password hashing is not currently relevant because there are no user passwords; keep the admin token long, secret and server-side.

## Scanner and application safeguards

The scanner validates schemes and allowed web ports, rejects URL credentials and local names, and conservatively blocks non-global IP ranges including IPv4-mapped IPv6, NAT64 and 6to4. Cancellable DNS lookup resolves once and pins the validated address for HTTP/TLS. Mixed private/public answers are rejected. Redirects are not followed; response bodies are destroyed at headers, not executed. Absolute six-second deadlines constrain both slow-drip HTTP and TLS inspections. DNS has a six-second cancellation deadline (two-second resolver attempts); one scan can take approximately 12 seconds including DNS, plus event-loop scheduling. Network-level outbound firewall rules remain necessary defense in depth; IP validation does not replace egress isolation.

Express enforces JSON bodies (16 KB), rate limits, bounded concurrent scans, static-root isolation, response security headers and constant-time admin token comparison. These checks reduce common abuse; they do not prove immunity to attacks or DDoS. No server-side test executes real malware or scans third-party malicious hosts.

## Capacity and stress limit

| Control | Per Node process |
| --- | --- |
| Concurrent scan jobs | 10; excess returns 503 with Retry-After: 5 |
| General requests | Default 120/minute/IP, including static and API requests |
| Scan/report requests | Shared default 15/minute/IP |
| Admin requests | Default 10/minute/IP, also subject to general limiter |
| Request body | 16 KB JSON |
| Outbound response header | 16 KB |
| DNS / HTTP / TLS deadline | Each phase up to 6 seconds; HTTP/TLS run in parallel after DNS |
| Stored history | Maximum 10,000 scans and 10,000 deduplicated reports |

These controls are not measured maximum users, RPS or availability guarantees. SQLite writes and purging are synchronous; all replicas need coordinated storage/limits if scaling. Rate limits are in memory and reset on restart; there is no distributed queue, caching, shared limiter or upstream DDoS protection. Deploy behind connection limits/WAF, isolate scanner workers and egress, and use a shared queue/limiter plus a suitable database before horizontal scaling. Do not mount the SQLite WAL database on network storage for replicas.

`scripts/capacity-tests.mjs` sends 20 concurrent scan requests and 100 health requests against a local isolated server. A two-second DNS fixture holds slots without contacting external sites: exactly 10 scans are admitted, 10 receive 503, and 100 health checks receive 200. One observed run completed in 2,132 ms with health-request p95 78 ms. This measures admission and recovery under controlled conditions, not real scanning throughput. It deliberately overrides per-IP rate limits for the test; separate regressions cover default limit rejection. Measure real p50/p95/p99 latency, errors, CPU, RSS, event-loop lag, disk and upstream quotas on staging matching production before publishing a traffic capacity.

## Validation

- `npm test`: detector regressions (real local HTTP/TLS and slow-drip sockets), isolated SQLite migration/privacy/retention regression, real Express security checks, local overload/recovery fixture.
- `npm run build --prefix client`: rebuilds the production frontend, preserving the existing layout and animations.
- `node scripts/verify-all.mjs` and `node scripts/verify-all-backend.mjs`: repository completion checks. The obsolete website check was updated to inspect the served React build, and the scan verifier accepts the new unknown verdict.
- `npm audit` in root and client: dependency advisory checks; not an application vulnerability audit. Frontend Vite and its React plugin were moved to patched compatible releases.

A browser rendering check was attempted but Chromium could not launch under this environment’s socket restrictions; visual behavior remains unverified. The production build and static asset checks passed.

No public production URL, hosting metrics, TLS proxy configuration, storage volumes, runtime logs or external provider credentials were supplied. Their security and live deployment behavior remain unverified. Repository changes are provided as a reviewable branch/PR, not automatically deployed.

## Work still required for the full problem statement

1. Add licensed/reliable threat-intelligence providers with timeouts, explicit provider success/unavailable states, freshness and attribution. Do not submit token-bearing URLs to public providers without a clear privacy policy and informed choice.
2. Add isolated content analysis for forms, brand impersonation and scripts, and a separately sandboxed malware-analysis service if required. Do not execute hostile pages in the API process. This requires a broader architecture and resource budget.
3. Implement CT and revocation evidence where supported, and distinguish “not checked”, “unavailable”, “valid” and “invalid”. A CT appearance is not proof of legitimacy.
4. Build a labelled benign/phishing/malware evaluation set and report precision, recall and calibration before claiming reliable detection. Include shorteners, legitimate login pages, IDNs, expired certificates and unreachable sites.
5. Add moderated/corroborated reporting and deployment monitoring/alerting, backup/restore exercises, encrypted infrastructure and staged load tests.

## Reference documentation

- Node TLS identity/authorization: https://nodejs.org/api/tls.html#tlscheckserveridentityhostname-cert
- OWASP SSRF prevention and DNS/redirect controls: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

These documents informed the safeguards; the test results above describe what was actually exercised locally.
