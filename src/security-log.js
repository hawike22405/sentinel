// Structured security event log (JSON lines on stderr). Never log secrets or request bodies.
const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300) : v);

export function logSecurity(event, fields = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(fields)) safe[k] = clean(k === 'url' ? (() => { try { return new URL(v).origin; } catch { return '[invalid URL]'; } })() : v); // strips control chars: no log injection
  console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'security', event, ...safe }));
}
