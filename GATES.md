# Gates: Sentinel — phishing/malicious website detection platform

OWNS: PRD.md, DESIGN.md, AGENTS.md, CLAUDE.md, docs/architecture.md, docs/code-standards.md, public/llms.txt, context/progress.md, index.html, assets/css/style.css, assets/js/app.js, scripts/**

Scope: Ship the essential `.md` foundation files and a professional vibe-coded website for Sentinel, an intelligent platform that detects phishing and malicious websites through threat analysis, web security assessment, certificate validation, and collaborative threat intelligence. Every outcome has a deterministic check.

- [x] G0: this ledger states outcomes that can fail
  CHECK: node scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: gate-lint.mjs printed `LINT OK` (exit 0)

- [x] G1: foundation `.md` files exist and are complete (PRD, DESIGN, AGENTS, CLAUDE, architecture, code-standards, llms.txt, progress)
  CHECK: node scripts/verify-foundation.mjs
  EXPECT: foundation verification passed
  EVIDENCE: verify-foundation.mjs: all 8 files PASS; `foundation verification passed` (exit 0)

- [x] G2: website is complete and correct (index.html + CSS + JS; hero, scanner, security assessment, certificate validation, threat intelligence; no placeholder slop)
  CHECK: node scripts/verify-website.mjs
  EXPECT: website verification passed
  EVIDENCE: verify-website.mjs: index.html + assets/css/style.css + assets/js/app.js present; hero/threat/security/certificate/intelligence keywords present; no lorem/coming-soon/placeholder; CSS and JS linked; `website verification passed` (exit 0)

- [x] G3: full re-verification is clean after implementation (lint + foundation + website)
  CHECK: node scripts/verify-all.mjs
  EXPECT: full verification passed
  EVIDENCE: verify-all.mjs: lint + foundation + website all clean; `full verification passed` (exit 0)
