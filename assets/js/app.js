/* Sentinel — animated interactions */
/* Theme toggle, custom cursor, load entrance, URL scanner, canvas globe */

(function () {
  'use strict';

  // ---------- Theme (dark / light) ----------
  const THEME_KEY = 'sentinel-theme';
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function loadTheme() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
    const theme = stored || getSystemTheme();
    setTheme(theme, false);
  }

  function setTheme(theme, animate = true) {
    if (!animate) {
      html.style.transition = 'none';
      document.body.style.transition = 'none';
    }
    html.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked */ }
    themeIcon.textContent = theme === 'light' ? '\u263E' : '\u2600'; // moon when light (->dark), sun when dark (->light)
    themeIcon.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    themeToggle.setAttribute('aria-pressed', theme === 'light');
    if (!animate) {
      requestAnimationFrame(() => {
        html.style.transition = '';
        document.body.style.transition = '';
      });
    }
  }

  themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next, true);
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
    if (!saved) {
      setTheme(e.matches ? 'light' : 'dark', true);
    }
  });

  // ---------- Custom cursor (tasteful, non-magnetic) ----------
  const dot = document.getElementById('cursor-dot');
  const outline = document.getElementById('cursor-outline');

  let mouse = { x: 0, y: 0 };
  let pos = { x: 0, y: 0 };
  let isHovered = false;

  function updateCursor() {
    const lerp = (a, b, t) => a + (b - a) * t;
    pos.x = lerp(pos.x, mouse.x, 0.22);
    pos.y = lerp(pos.y, mouse.y, 0.22);
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    outline.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    requestAnimationFrame(updateCursor);
  }

  window.addEventListener('mousemove', (e) => {
    if (!outline) return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!outline.classList.contains('visible')) {
      outline.classList.add('visible');
    }
  });

  function setHovered(on) {
    isHovered = on;
    if (on) outline.classList.add('hovered');
    else outline.classList.remove('hovered');
  }

  function clickRipple(x, y) {
    outline.classList.add('click-ripple');
    setTimeout(() => outline.classList.remove('click-ripple'), 500);
  }

  document.querySelectorAll('a, button, .btn, input, select, .card-glass').forEach((el) => {
    el.addEventListener('mouseenter', () => setHovered(true));
    el.addEventListener('mouseleave', () => setHovered(false));
    el.addEventListener('mousedown', (e) => clickRipple(e.clientX, e.clientY));
  });

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (dot && outline && finePointer) updateCursor();

  // ---------- Load entrance ----------
  const preload = document.getElementById('page-preload');

  function finishLoad() {
    if (preload) {
      preload.classList.add('fade-out');
      setTimeout(() => preload.remove(), 600);
    }
    html.classList.remove('is-loading');
    document.body.classList.remove('is-loading');
    if (finePointer) html.classList.add('m-cursor');
  }

  window.addEventListener('load', () => {
    setTimeout(finishLoad, 700);
  });

  // ---------- URL scanner (calls POST /api/scan) ----------
  const form = document.getElementById('scan-form');
  const input = document.getElementById('url-input');
  const errorEl = document.getElementById('form-error');
  const scoreEl = document.getElementById('gauge-score');
  const needleEl = document.getElementById('gauge-needle');
  const verdictEl = document.getElementById('result-verdict');
  const explanationEl = document.getElementById('result-explanation');

  const checks = {
    reputation: document.getElementById('check-reputation'),
    headers: document.getElementById('check-headers'),
    certificate: document.getElementById('check-certificate'),
    threat: document.getElementById('check-threat-intel'),
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  }
  function removeClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  }

  function renderCheck(checkEl, status, label, detail) {
    const textEl = checkEl.querySelector('.text');
    const strong = textEl.querySelector('strong');
    const span = textEl.querySelector('span');
    removeClass(checkEl, 'check--ok check--warn check--bad');
    addClass(checkEl, 'check--' + status);
    strong.textContent = label;
    span.textContent = detail;
  }

  function verdictToBadge(verdict) {
    return {
      safe: 'badge--safe',
      suspicious: 'badge--suspicious',
      malicious: 'badge--malicious',
    }[verdict] || 'badge--suspicious';
  }

  async function scanViaApi(url) {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    let body = {};
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) {
      throw new Error(body.error || 'Scan failed.');
    }
    return {
      score: body.score,
      verdict: body.verdict,
      url: body.url,
      checks: body.checks,
      created_at: body.created_at,
    };
  }

  function render(state) {
    const { score, verdict, url, checks: checkResults, error } = state;
    const badge = verdictToBadge(verdict);
    scoreEl.textContent = score;
    const rotateDeg = 45 + (score / 100) * 180;
    needleEl.style.transform = 'translate(-50%, -100%) rotate(' + rotateDeg + 'deg)';
    const verdictLabel = verdict.charAt(0).toUpperCase() + verdict.slice(1);
    verdictEl.textContent = verdictLabel;
    verdictEl.className = 'badge ' + badge;
    const firstDetail = (checkResults && checkResults.reputation && checkResults.reputation.detail) || '';
    explanationEl.textContent = error ||
      (verdictLabel + ' ' + (firstDetail ? '\u2014 ' + firstDetail : 'No strong risk signals detected.'));
    renderCheck(checks.reputation, checkResults.reputation.status, 'Reputation', checkResults.reputation.detail);
    renderCheck(checks.headers, checkResults.headers.status, 'Security headers', checkResults.headers.detail);
    renderCheck(checks.certificate, checkResults.certificate.status, 'Certificate', checkResults.certificate.detail);
    renderCheck(checks.threat, checkResults.threat.status, 'Threat intelligence', checkResults.threat.detail);
    if (url) renderCert(checkResults.certificate.info);
  }

  function renderCert(info) {
    const set = (id, v) => { document.getElementById(id).textContent = v || 'Unavailable'; };
    set('cert-issuer', info && info.issuer);
    set('cert-expires', info && info.expires);
    set('cert-chain', info && info.chain);
    set('cert-fingerprint', info && info.fingerprint);
  }

  function showError(message) {
    errorEl.textContent = message;
    input.focus();
  }

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    errorEl.textContent = '';
    const raw = input.value.trim();
    if (!raw) { showError('Please enter a website URL.'); return; }
    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (err) { showError('That does not look like a valid URL.'); return; }
    input.blur();
    const btn = document.getElementById('scan-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Scanning…';
    try {
      const result = await scanViaApi(url);
      render(result);
    } catch (err) {
      showError(err.message || 'Scan failed. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // Initial state
  render({
    score: 0,
    verdict: 'safe',
    url: null,
    checks: {
      reputation: { status: 'ok', detail: 'Submit a URL to begin.' },
      headers: { status: 'warn', detail: 'Submit a URL to begin.' },
      certificate: { status: 'ok', detail: 'Submit a URL to begin.' },
      threat: { status: 'warn', detail: 'Submit a URL to begin.' },
    },
    error: null,
  });


  // ---------- Community threat feed (backend /api/feed) ----------
  const feedList = document.getElementById('feed-list');
  const reportForm = document.getElementById('report-form');
  const reportMsg = document.getElementById('report-msg');

  function timeAgo(iso) {
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (Number.isNaN(secs)) return '';
    if (secs < 60) return 'just now';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
    if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
    return Math.floor(secs / 86400) + 'd ago';
  }

  async function loadFeed() {
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error('feed unavailable');
      const { reports } = await res.json();
      feedList.replaceChildren();
      if (!reports.length) {
        const p = document.createElement('p');
        p.className = 'meta';
        p.textContent = 'No community reports yet. Be the first to report a suspicious site.';
        feedList.appendChild(p);
        return;
      }
      for (const r of reports) {
        const item = document.createElement('div');
        item.className = 'feed-item';
        const info = document.createElement('div');
        info.className = 'info';
        const url = document.createElement('div');
        url.className = 'url';
        url.textContent = r.url; // textContent: report data is untrusted
        const meta = document.createElement('span');
        meta.className = 'meta mono';
        meta.textContent = [r.type, timeAgo(r.created_at), r.source].filter(Boolean).join(' \u00B7 ');
        info.append(url, meta);
        const badge = document.createElement('span');
        badge.className = 'badge badge--suspicious';
        badge.textContent = 'Reported';
        item.append(info, badge);
        feedList.appendChild(item);
      }
    } catch {
      feedList.textContent = 'The threat feed is unavailable. Start the backend with npm start.';
    }
  }

  reportForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    reportMsg.className = 'form-error';
    reportMsg.textContent = '';
    let url = document.getElementById('report-url').value.trim();
    if (!url) { reportMsg.textContent = 'Enter the website address to report.'; return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const res = await fetch('/api/feed/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: document.getElementById('report-type').value }),
      });
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(body.error || 'Report failed.');
      reportMsg.className = 'form-error form-ok';
      reportMsg.textContent = 'Thank you. Your report was added.';
      document.getElementById('report-url').value = '';
      loadFeed();
    } catch (err) {
      reportMsg.textContent = err.message;
    }
  });

  loadFeed();

  // ---------- Terminal animation (replaces globe visual) ----------
  const typingEl = document.getElementById('terminal-typing');
  const cursorEl = document.getElementById('terminal-cursor');

  const terminalLines = [
    { text: 'sentinel@cli:~$ ./scan --target example.com --deep', delay: 400 },
    { text: '  [1/4] threat analysis: no known-bad listings found', delay: 600 },
    { text: '  [2/4] web security: strict-transport-security missing', delay: 600 },
    { text: '  [3/4] certificate: valid chain — issuer Sectigo R3', delay: 600 },
    { text: '  [4/4] threat intelligence: 0 community reports', delay: 600 },
    { text: 'sentinel@cli:~$ scan complete — risk score: 0 (safe)', delay: 800 },
    { text: '', delay: 1200 },
    { text: 'sentinel@cli:~$ ./scan --target secure-account-login-verify-paypal.example.com --deep', delay: 400 },
    { text: '  [1/4] threat analysis: 5 credential-harvesting keywords detected', delay: 600 },
    { text: '  [2/4] web security: multiple headers missing', delay: 600 },
    { text: '  [3/4] certificate: self-signed intermediate', delay: 600 },
    { text: '  [4/4] threat intelligence: 2 community reports in 24h', delay: 600 },
    { text: 'sentinel@cli:~$ scan complete — risk score: 89 (malicious)', delay: 800 },
  ];

  let lineIndex = 0;
  let charIndex = 0;
  let isTyping = true;
  let rafId = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typeNext() {
    if (!typingEl || !cursorEl) return;
    if (reduced) {
      // Under reduced motion: show all lines at once, no typing
      typingEl.textContent = terminalLines.map(l => l.text).join('\n');
      cursorEl.style.opacity = '0';
      return;
    }

    const line = terminalLines[lineIndex];
    if (!line) {
      // Finished all lines, loop back
      lineIndex = 0;
      charIndex = 0;
    }

    const currentLine = terminalLines[lineIndex];
    if (charIndex < currentLine.text.length) {
      typingEl.textContent = currentLine.text.slice(0, charIndex + 1);
      charIndex++;
      setTimeout(typeNext, 40);
    } else {
      // Line complete, move to next after delay
      setTimeout(() => {
        lineIndex++;
        charIndex = 0;
        typeNext();
      }, currentLine.delay);
    }
  }

  // Start the animation after the page has loaded
  if (typingEl && cursorEl) {
    setTimeout(typeNext, 800);
  }
})();
