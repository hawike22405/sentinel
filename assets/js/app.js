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

  // ---------- Canvas globe (magicui-style reference visual) ----------
  const canvas = document.getElementById('globe');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let points = [];
    let angle = 0;
    let rafId;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      width = canvas.parentElement.clientWidth || 340;
      height = canvas.parentElement.clientHeight || 340;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedPoints();
    }

    function seedPoints() {
      points = [];
      const count = 70;
      const r = Math.min(width, height) * 0.42;
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        points.push({
          x: cx + r * Math.sin(phi) * Math.cos(theta),
          y: cy + r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
        });
      }
    }

    function rotateY(p, a) {
      const s = Math.sin(a);
      const c = Math.cos(a);
      const x = p.x * c + p.z * s;
      const z = -p.x * s + p.z * c;
      return { x, y: p.y, z };
    }

    function project(p) {
      const focal = 560;
      const scale = focal / (focal + p.z);
      return { x: (p.x - width / 2) * scale + width / 2, y: (p.y - height / 2) * scale + height / 2, scale };
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      angle += reduced ? 0 : 0.009;
      const projected = points.map((p) => project(rotateY(p, angle)));
      // draw lines between nearby points
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            const alpha = 1 - d / 110;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = 'rgba(56, 189, 248, ' + (alpha * 0.35) + ')';
            ctx.lineWidth = 0.8 * alpha;
            ctx.stroke();
          }
        }
      }
      // draw points
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 * p.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, ' + (0.5 + 0.5 * p.scale) + ')';
        ctx.fill();
      }
      rafId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
  }
})();
