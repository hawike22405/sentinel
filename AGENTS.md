# AGENTS.md — Sentinel cross-agent rules

This file establishes build/test commands, directory structure, and component allow-lists so every agent and tool works from the same contract. Place a bare `@AGENTS.md` import at the top of CLAUDE.md to load these rules on every turn.

## Directory structure
```
/sentinel
  PRD.md                 # product requirements
  DESIGN.md              # visual design system & tokens
  AGENTS.md              # this file
  CLAUDE.md              # persistent tool context
  docs/
    architecture.md      # system boundaries, patterns, integrations, state
    code-standards.md    # reusable patterns & utilities
  public/
    llms.txt             # documentation index
  context/
    progress.md          # session memory (slices, bugs, next steps)
  index.html             # animated presentation layer
  assets/css/style.css   # design tokens (dark + light), glassmorphism, motion
  assets/js/app.js       # theme toggle, cursor, load entrance, scanner, canvas globe
  scripts/               # verification oracles (gate checks)
```

## Build / test commands
- `node scripts/gate-lint.mjs GATES.md` — lint the completion ledger (must print `LINT OK`).
- `node scripts/verify-foundation.mjs` — verify all `.md` foundation files are complete.
- `node scripts/verify-website.mjs` — verify the website structure and assets.
- `node scripts/verify-all.mjs` — full re-verification (lint + foundation + website).
- Open `index.html` directly in a browser to review the presentation layer (no build step, no dev server).

## Component allow-list (UI primitives only)
Buttons: primary (accent), outline, glass (sizes md). Cards: glass card.
Inputs: text/url input with focus ring.
Badges: safe / suspicious / malicious verdict chips.
Visuals: canvas globe, radial gauge, needle, Lightfall page background (WebGL, fixed behind content, colors from tokens, respects `prefers-reduced-motion`).
Glassmorphism: `.btn`, `.card-glass`, `.input`, `.nav`, `.theme-toggle`, `.feed`.

## Styling rules
- Use CSS custom properties from `assets/css/style.css` only; no raw hex values in markup or JS.
- Dark theme by default with a manual light/dark toggle (persisted in localStorage, system preference respected).
- Responsive. Max content width 1040px, centered.
- Motion: load entrance (hero fades up once), custom cursor, hover/press states on all interactive elements, Lightfall background. Respects `prefers-reduced-motion`.
- Glassmorphism: translucent surfaces with `backdrop-filter: blur`, subtle borders, no gradients except accents, no blobs, no neon.

## Prohibited patterns (AI slop)
- Purple/violet gradients, acid-green neon, generic blobs, soft grey shadows.
- ALL-CAPS labels, middle-dot meta strings, `→` on every link.
- Lorem ipsum, tiny fake body copy, invented metrics dashboards.
- Magnetic buttons, tilting cards, scroll-reveal fades on every section, marquees.
