import { useEffect, useState } from 'react';
import Lightfall from './Lightfall';

// Lightfall takes color strings, not CSS variables, so resolve the design
// tokens at runtime and re-resolve whenever the theme toggle flips.
function readTokens() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name) => css.getPropertyValue(name).trim();
  return {
    isLight: root.getAttribute('data-theme') === 'light',
    accent: token('--color-accent'),
    text: token('--color-text'),
  };
}

export default function PageBackground() {
  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Wait for tokens so the first frame already uses the right theme colors.
  if (!tokens || !tokens.accent) return null;

  const { isLight, accent, text } = tokens;

  return (
    <div className="page-bg" aria-hidden="true">
      <Lightfall
        colors={isLight ? [accent] : [text, accent]}
        backgroundColor={accent}
        backgroundGlow={isLight ? 0 : 0.12}
        lightMode={isLight}
        opacity={isLight ? 0.4 : 0.5}
        speed={0.25}
        streakCount={2}
        streakWidth={0.8}
        twinkle={0.3}
        headGlow={0.6}
        bloom={0.35}
        mouseInteraction
        holdToWarp={false}
        intro
        dpr={1.5}
      />
    </div>
  );
}
