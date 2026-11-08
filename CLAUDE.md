# CLAUDE.md — Sentinel persistent tool context

This file bridges Claude Code's tool-specific memory with the shared repository rules. It imports AGENTS.md at the top so those rules load on every turn.

@AGENTS.md

## Project
Sentinel — phishing / malicious website detection platform combining threat analysis, web security assessment, certificate validation, and collaborative threat intelligence.

## Working conventions
- This is a static presentation layer: `index.html`, `assets/css/style.css`, `assets/js/app.js`. No build step, no framework, no dev server.
- Every change must be reflected in `context/progress.md` (completed slice, active bug, next step).
- Before declaring a slice complete, run `node scripts/verify-all.mjs` and confirm `full verification passed`.
- Never add a component outside the AGENTS.md allow-list without first updating AGENTS.md and DESIGN.md.

## When to ask
- If asked to add real network scanning, certificate authority integration, user accounts, or payments — these are explicit non-goals in PRD.md; decline or flag as out of scope.
