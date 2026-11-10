# Architecture — Sentinel

## System boundary

React/Vite builds to `public/`. Express serves only that directory and the JSON API. The root `index.html` is an older standalone prototype, not the deployed Express entry. The backend contacts submitted HTTP(S) targets and stores limited results in SQLite outside the public root. See [the current audit](security-audit.md) for the feature boundary and deployment requirements.

## Logical modules

1. `src/detector.js`: URL validation and heuristic scoring, cancellable DNS resolution, pinned-address HTTP and TLS observations, evidence availability and limitations.
2. `src/routes.js`: input validation, scan admission (10 slots), result retrieval, public unverified reporting and protected report deletion.
3. `src/store.js`: origin-only SQLite records, prepared statements, legacy privacy migration, report deduplication, age/count retention.
4. `server.js`: transport/proxy configuration, JSON/body/rate limits, application response headers and static-root isolation.
5. `client/src`: URL submission, evidence display, risk contribution chart, unverified report feed and existing visual components.

## State management

React holds the current scan response and report feed in component state. API results carry score version, assessment completeness, component contributions and individual checks. The legacy verdict strings remain compatibility bands; `unknown` explicitly represents an incomplete assessment. No client fallback fabricates a result when the API fails.

SQLite stores scans and reports. In-flight admission and rate-limit buckets live in process memory; they are not shared across replicas. Stored result UUIDs are bearer-style retrieval identifiers, not authenticated private history.

## Third-party integrations

No reputation provider or malware-analysis service is configured. Direct outbound DNS/HTTP/TLS observations are real. No page body is downloaded or executed, and no redirects are followed. TLS validation uses the runtime CA trust store; transparency and revocation services are not consulted. Frontend fonts/assets are bundled locally.

## Reusable patterns

- Existing CSS tokens and badge classes continue to define the presentation.
- Scan and report validation share `validateUrl`; storage privacy shares `storageUrl`.
- HTTP and TLS share pinned-address lookup and six-second absolute observation deadlines.
- Deterministic local socket/SQLite fixtures validate behavior without contacting hostile third-party sites.
