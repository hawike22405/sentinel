# Architecture — Sentinel

## System boundary
Sentinel's presentation layer is a single-page static website. It defines one system boundary: the browser tab. It does not perform live network scanning, does not contact certificate authorities, and does not store user data. All detection results in this slice are simulated for demonstration and review purposes.

## Logical modules
1. **Threat analysis** — reputation and known-bad list evaluation (simulated).
2. **Web security assessment** — HTTP headers, exposed services, software freshness (simulated).
3. **Certificate validation** — TLS chain, expiry, transparency, cryptographic strength (simulated).
4. **Collaborative threat intelligence** — community-reported threats with source and date.

## State management
Vanilla JavaScript module pattern. UI state lives in a single `state` object (current URL, risk score, verdict, check results, feed entries). The DOM is updated by a `render()` function reading from `state` — no duplicate rendering paths.

## Third-party integrations
None in this slice. No external APIs, no analytics, no third-party scripts. Fonts use the system font stack to avoid network dependencies.

## Reusable patterns
- Risk score → color mapping (safe/suspicious/malicious) defined once in `assets/css/style.css`.
- Verdict badge component: one class set reused across scanner result and feed.
- URL input with inline validation: single handler, single error container.
