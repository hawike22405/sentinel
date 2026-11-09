# DESIGN.md — Sentinel visual design system

## Visual mode
Dark Security / Threat Intelligence with a manual light/dark theme. Near-black canvas by default, glassmorphism surfaces, one sky-blue accent carrying verification, red/amber/emerald verdict chips, radar-style globe visual, radial risk gauge, tasteful custom cursor.

## Token system (source of truth: assets/css/style.css)

```yaml
colors:
  base: "#000000"
  surface: "rgba(20,20,20,0.55)"
  border: "rgba(255,255,255,0.08)"
  text: "#f8fafc"
  textMuted: "#94a3b8"
  accent: "#38bdf8"
  danger: "#ef4444"
  warning: "#f59e0b"
  success: "#22c55e"
  glassBg: "rgba(20,20,20,0.45)"
  glassBorder: "rgba(255,255,255,0.07)"
typography:
  body: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
spacing:
  nav: "72px"
  maxWidth: "1040px"
rounded:
  lg: "16px"
  md: "12px"
  sm: "8px"
  pill: "9999px"
components:
  - btn
  - card-glass
  - input
  - theme-toggle
  - badge
  - gauge
```


Dark (default):
- bg: #000000, surface: rgba(20,20,20,0.55), border: rgba(255,255,255,0.08)
- text: #f8fafc, text-muted: #94a3b8
- accent: #38bdf8 (sky), danger: #ef4444, warning: #f59e0b, success: #22c55e
- glass-bg: rgba(15,23,42,0.42), glass-border: rgba(255,255,255,0.07)

Light ([data-theme="light"]):
- bg: #f7f9fc, surface: rgba(255,255,255,0.62), border: rgba(2,6,23,0.09)
- text: #0f172a, text-muted: #475569
- accent: #0ea5e9, danger: #b50909, warning: #7a5200, success: #1e6b2b
- glass-bg: rgba(255,255,255,0.58), glass-border: rgba(2,6,23,0.10)

Typography: Inter / system-ui sans-serif; monospace for URLs, hashes, fingerprints.
Radius: lg 16px, md 12px, sm 8px, pill 9999px.
Nav: fixed 72px, translucent with blur.

## Components (allow-list per AGENTS.md)
- btn (glass outline + accent filled), card-glass, input (glass), theme-toggle, badge (verdict chips), gauge (radial + needle), canvas globe.
- Lightfall page background: fixed full-viewport WebGL light-streak effect behind all content (`client/src/components/PageBackground.jsx`). Streak colors come from `--color-text` and `--color-accent`; dark theme uses additive light, light theme uses `lightMode` with the accent only. Kept at 0.4-0.5 opacity so body text stays legible; mouse lens enabled, hold-to-warp disabled so it never fights the scan input.

## Prose rules (no AI slop)
- No purple/violet gradients, acid-green neon, blobs, soft grey shadows, magnetic buttons, tilting cards.
- No ALL-CAPS labels, middle-dot meta strings, `→` on links. Sentence case throughout.
- No lorem ipsum, tiny fake body copy, invented metrics dashboards.
- Scroll-reveal fades on every section are prohibited; motion is limited to the hero load entrance, cursor, hover/press, the canvas globe, and the Lightfall background.
- Mockups are identity applications (browser chrome, URL bar, certificate card, threat chip), not fake dashboards full of invented metrics.
- Very little text: brand name, one tagline, section labels, short UI chips, one command.
