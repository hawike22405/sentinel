# Vercel deployment

The full Express API and React frontend deploy together from the repository root. `vercel.json` selects the Express framework, builds the React app into `public/`, and sets a 30-second function budget. Node is pinned to 24.x. The scanner itself retains its 15-second deadline. Vercel serves public assets through its CDN, so equivalent static-response security headers are included in vercel.json.

## Persistent database

A hosted Turso/libSQL database is required for Vercel. Local runs keep the existing better-sqlite3 file unless TURSO_DATABASE_URL is configured. No local SQLite history is uploaded automatically. The cloud database starts separately and uses origin-only records, report deduplication and the existing 30-day/10,000-row limits.

Set these server-side Vercel environment variables for both the intended Preview and Production environments:

- TURSO_DATABASE_URL: the TLS-protected libsql:// or https:// database URL.
- TURSO_AUTH_TOKEN: the database access token, stored as a secret.
- NODE_ENV=production.
- ADMIN_TOKEN: optional existing moderation token, at least 32 characters, stored as a secret.

Keep FORCE_HTTPS=0 unless canonical-host and proxy configuration are explicitly verified; Vercel provides public HTTPS. Configure TRUST_PROXY=1 only for the trusted Vercel ingress topology, with no additional untrusted direct ingress. Do not hardcode PORT or FRONTEND_ORIGIN for this same-origin deployment.

The Express app exports a default handler and does not bind a port or install shutdown listeners when VERCEL is set. Production startup refuses missing database credentials rather than writing ephemeral data. /api/health verifies storage and returns 503 when it is unavailable. Schema creation is idempotent and performed lazily on the first storage request. API handlers await both local and hosted stores.

Cloud cleanup runs on requests/writes, without depending on a frozen function's background timer. Reads exclude expired records immediately. Physical cleanup while the service is entirely idle requires a separately configured authenticated scheduled job if strict deletion timing is required. Hosted storage queries/initialization can consume provider quotas. Rate limits and scan admission remain per instance rather than globally shared; configure platform-level abuse and spending controls for a public beta.

## Publishing steps

1. Connect/import hawike22405/sentinel with repository root as the project directory and select the tested deployment branch.
2. Provision or connect a hosted Turso/libSQL database; use its server-side URL and token as the secret environment variables above. Do not put tokens in source, public assets or chat messages.
3. Deploy a Preview and check /api/health, /api/feed, a benign GitHub scan and retrieval of its ID. Check report submission/deduplication in a test database and verify persistence across redeploys.
4. Publish Production only after those hosted checks pass. Existing UI risk limitations still apply.

No production domain, project ID, database credentials or successful hosted deployment is implied by these configuration files. The hosting account and database must actually be configured and the resulting URL verified.

## Validation

Local tests cover the existing SQLite behavior, SQL compatibility/privacy/retention of the hosted adapter through an injected SQLite client, Vercel handler import without a listener/filesystem writes, missing-storage rejection, Express security regressions and overload handling. These do not substitute for a live Turso and Vercel smoke test.

References:
- https://vercel.com/docs/frameworks/backend/express
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/marketplace-storage
- https://github.com/tursodatabase/libsql-client-ts
