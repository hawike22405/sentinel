# Sentinel — Plan & Scope Inventory

## Scope
Build a professional, vibe-coded website plus the essential `.md` foundation files for **Sentinel** — an intelligent platform that detects phishing and malicious websites by combining threat analysis, web security assessment, certificate validation, and collaborative threat intelligence.

## Independently required outcomes (each gets a gate in GATES.md)

1. `PRD.md` — product requirements: target user, core user flow, observable acceptance checks, explicit non-goals.
2. `DESIGN.md` — visual design system & tokens (YAML) and prose rules that prevent AI slop (no purple SaaS gradients, no generic layouts).
3. `AGENTS.md` — cross-agent rules: build/test commands, directory structure, component allow-lists.
4. `CLAUDE.md` — persistent tool-specific context that imports `AGENTS.md`.
5. `docs/architecture.md` — system boundaries, patterns, third-party integrations, state management.
6. `docs/code-standards.md` — reusable patterns and utilities so nothing is invented twice.
7. `public/llms.txt` — documentation index for agents.
8. `context/progress.md` — persistent session memory (completed slices, active bugs, next steps).
9. Website (`index.html` + `assets/css/style.css` + `assets/js/app.js`) — hero, URL threat scanner, web security assessment, certificate validation, collaborative threat intelligence feed; dark security aesthetic; no AI slop.
10. Verification — every gate re-verified clean and lint passes.

## Non-goals
- No live backend, no real network scanning, no actual certificate authority integration (this is the presentation layer / verification harness).
- No user accounts, payments, or multi-tenancy in this slice.
