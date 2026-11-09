import { useEffect, useState, useCallback } from 'react';
import MagicRings from './MagicRings';
import './RingsIntro.css';

// How long the rings stay on screen before fading out (ms).
const SHOW_MS = 3200;
// Fade-out duration (ms). Keep in sync with the transition in RingsIntro.css.
const FADE_MS = 700;

export default function RingsIntro({ onFinish }) {
  const [phase, setPhase] = useState('show'); // 'show' | 'fade' | 'done'

  const finish = useCallback(() => {
    setPhase((current) => {
      if (current === 'done') return current;
      return 'fade';
    });
    setTimeout(() => {
      setPhase('done');
      if (typeof onFinish === 'function') {
        onFinish();
      }
    }, FADE_MS);
  }, [onFinish]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('rings-intro-lock');
    if (body) body.classList.add('rings-intro-lock');

    // Fast-path if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const activeShowMs = prefersReducedMotion ? 600 : SHOW_MS;

    const fadeTimer = setTimeout(() => {
      setPhase('fade');
      if (typeof onFinish === 'function') {
        onFinish();
      }
    }, activeShowMs);

    const doneTimer = setTimeout(() => {
      setPhase('done');
    }, activeShowMs + FADE_MS);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        finish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      window.removeEventListener('keydown', handleKeyDown);
      html.classList.remove('rings-intro-lock');
      if (body) body.classList.remove('rings-intro-lock');
    };
  }, [onFinish, finish]);

  useEffect(() => {
    if (phase === 'done') {
      document.documentElement.classList.remove('rings-intro-lock');
      if (document.body) document.body.classList.remove('rings-intro-lock');
    }
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={`rings-intro${phase === 'fade' ? ' rings-intro--fade' : ''}`}
      aria-hidden="true"
    >
      <MagicRings
        color="#A855F7"
        colorTwo="#6366F1"
        motion="pulse"
        ringCount={6}
        speed={1}
        lineThickness={2}
        glow={1}
        hoverScale={1.2}
        clickBurst={true}
      />

      <div className="rings-intro-center">
        <div className="rings-intro-brand">
          <span className="rings-intro-dot">●</span>
          <span>Sentinel</span>
        </div>
        <span className="rings-intro-status">Initializing defenses</span>
      </div>

      <button
        type="button"
        className="rings-intro-skip"
        onClick={finish}
        aria-label="Skip intro animation"
      >
        Skip ✕
      </button>
    </div>
  );
}
