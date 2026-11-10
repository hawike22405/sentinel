# Flame scan buttons

## Existing project and paths

Sentinel uses React 18, JavaScript/JSX, Vite and ordinary CSS. `lucide-react` is already installed in `client/package.json`. The Vite alias `@` maps to `client/src`; `client/jsconfig.json` provides the same path mapping for editors. UI primitives already live at `client/src/components/ui`, imported as `@/components/ui/...`. This is the app's equivalent of `/components/ui`; creating another folder at the repository root would bypass the actual frontend source/alias.

The adapted component is `client/src/components/ui/flame-button.jsx`; its scoped styles are in the adjacent `flame-button.css`, imported by the component. Existing global tokens/styles remain in `client/src/App.css`. A small example is `flame-button-demo.jsx`; the existing loader demo is not overwritten.

## Integration

The navigation button links to `#hero`, where the URL input lives. The hero scan button is a real `type="submit"` button inside the existing CurvedInput form. It submits the current URL, preserves Enter-key submission, changes to Scanning… and disables while the request is pending. CurvedInput's default SVG/transparent button remains available for other callers; a new optional renderButton callback supplies the flame button for the scanner. The curved URL input itself is retained.

No context providers, state library, images or stock photos are needed. The right arrow uses lucide-react. Pointer coordinates update local CSS variables; CSS transitions ease the flare without an always-running animation-frame loop. Keyboard focus has a visible outline; touch uses the native button; reduced-motion styling removes transitions and fixes the inner hotspot at the center. Percentage coordinates adapt to resizing. Button labels retain the site's existing sentence case.

Props: `text`, `showArrow`, `height`, `textColor`, `borderColor`, `href`, `onClick`, plus `type`, `disabled`, wrapper `className`/`style`, `target` and native control attributes. Without href it renders a native button. Internal hash links navigate in-page. External HTTP(S) hrefs default to a new tab with noopener/noreferrer. No author/social URL is hardcoded, so pressing Scan link never sends a visitor away to X.

```jsx
import { FlameButton } from '@/components/ui/flame-button';

<FlameButton text="Scan a link" href="#hero" />
<FlameButton text="Scan link" type="submit" disabled={isScanning} />
```

## Optional full shadcn/Tailwind/TypeScript setup

This integration deliberately uses the JSX/CSS version requested for the existing website. Tailwind and TypeScript are not required for it. If adopting the original utility-class/TSX version or the shadcn CLI later, follow the official guides rather than replacing the existing app:

1. In `client`, install Tailwind's Vite integration: `npm install tailwindcss @tailwindcss/vite`.
2. Import `tailwindcss` from `@tailwindcss/vite` and add `tailwindcss()` alongside the existing React plugin in `vite.config.js`; add `@import "tailwindcss";` before other CSS imports in `src/App.css`. Review Tailwind's reset against existing controls and layouts before committing.
3. Run `npx shadcn@latest init` inside `client`. Keep CSS at `src/App.css`, aliases `@/components`, `@/components/ui` and `@/lib/utils`, and set `tsx: false` in components.json for JavaScript. Do not overwrite existing UI files without reviewing changes.
4. For an optional TypeScript migration, install `npm install -D typescript @types/react @types/react-dom`, create a tsconfig using React JSX, ESNext modules, Bundler resolution, `noEmit` and the same `@/*` mapping, then opt files into `.tsx` and run `npx tsc --noEmit`. The current JavaScript variant needs none of this migration.

Official sources:
- https://tailwindcss.com/docs/installation/using-vite
- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/javascript
- https://ui.shadcn.com/docs/components-json

Build with `npm run build --prefix client`, then start the Express server. The committed `public/` build includes the component; a pull does not require an extra frontend install to use that build.
