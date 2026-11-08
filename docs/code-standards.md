# Code standards — Sentinel

## Reusable patterns
- **Design tokens:** all colors, spacing, radius, and typography values are CSS custom properties in `assets/css/style.css`. No raw hex values in HTML or JS.
- **Verdict badge:** `.badge--safe`, `.badge--suspicious`, `.badge--malicious` — one badge system reused by the scanner result and the threat-intelligence feed.
- **Panel card:** `.card` for every content panel (consistent border, radius, padding).
- **Section:** `.section` with centered max-width container and generous vertical padding.
- **Muted label:** `.label-small` for technical metadata (issuer, expiry, fingerprint) in monospace.

## Utilities
- `hasClass(el, cls)`, `addClass(el, cls)`, `removeClass(el, cls)` — tiny DOM class helpers.
- `escapeHtml(str)` — escape user-supplied text before inserting into the DOM.
- `formatDate(iso)` — render an ISO date string as a short local date.
- `scoreToVerdict(score)` — map 0–100 to `{ verdict, badgeClass, color }` (single source of truth).

## Rules
- No duplicate patterns: if a UI element repeats, extract it into one of the above classes or utilities.
- All text is sentence case. No ALL-CAPS. No middle dots. No `→` link suffixes.
- Respect `prefers-reduced-motion`: transitions only on user interaction.
- Validate every gate with `node scripts/verify-all.mjs` before declaring work complete.
