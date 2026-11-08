# PRD — Sentinel

## Product
Sentinel is an intelligent platform that detects phishing and malicious websites by combining threat analysis, web security assessment, certificate validation, and collaborative threat intelligence. It gives anyone a fast, trustworthy verdict on a link before they click.

## Target user
Security-conscious individuals, small IT teams, educators, and remote workers who receive unsolicited links (banking, recruitment, payments, government services) and need to verify them quickly without installing software.

## Core user flow
1. User pastes a URL into the Sentinel scanner.
2. Sentinel runs four checks in parallel: threat analysis (known-bad lists, reputation), web security assessment (headers, exposed services, outdated software), certificate validation (chain, transparency, cryptographic strength), and collaborative threat intelligence (community reports).
3. Sentinel returns a single risk score (0–100), a verdict (safe / suspicious / malicious), and a short plain-language explanation of what drove the score.

## Observable acceptance checks
- A URL can be submitted and returns a risk score between 0 and 100.
- The verdict (safe / suspicious / malicious) is displayed prominently with a color-coded badge.
- Each of the four check categories shows a pass/fail/warning result and a one-line reason.
- Certificate validation shows issuer, expiry, and chain status when the site uses HTTPS.
- The collaborative threat intelligence feed lists recent community-reported threats with source and date.
- Invalid or empty input shows a clear inline error without reloading the page.

## Explicit non-goals
- No live network scanner or real-time certificate authority integration in this slice (results are simulated for the presentation layer).
- No user accounts, authentication, payments, or multi-tenancy.
- No browser extension or mobile app.
- No automatic blocking of URLs at the network level.
