import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('sentinel-theme');
    const system = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
    setTheme(stored || system);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    localStorage.setItem('sentinel-theme', theme);
  }, [theme, mounted]);

  const toggle = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const icon = theme === 'light' ? '☀' : '🌙';
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button
      type="button"
      className="theme-toggle ghost"
      onClick={toggle}
      aria-pressed={theme === 'light'}
      aria-label={label}
    >
      <span id="theme-icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
