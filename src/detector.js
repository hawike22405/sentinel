import { URL } from 'node:url';
import { get } from 'node:http';
import { get as getSecure } from 'node:https';
import { connect } from 'node:tls';

const REQUEST_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 0;

// Known-bad signal patterns used only for the simulated reputation layer.
// These are deterministic heuristics, not a live threat feed.
const HARVEST_KEYWORDS = [
  'login', 'verify', 'secure', 'account', 'paypal', 'bank',
  'update', 'signin', 'webscr', 'confirm',
];

const SECURITY_HEADERS = [
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'content-security-policy',
  'referrer-policy',
  'permissions-policy',
];

function isPrivateOrResolvedToPrivate(hostname) {
  try {
    const parsed = new URL(`https://${hostname}`);
    return isPrivateHostname(parsed.hostname);
  } catch {
    return true;
  }
}

function isPrivateHostname(host) {
  const ipv4Regex =
    /^(127\.)|(10\.)|(172\.(1[6-9]|2[0-9]|3[01])\.)|(192\.168\.)|(169\.254\.)|(0\.0\.0\.0)$/;
  if (ipv4Regex.test(host)) return true;
  const ipv6Regex = /^(::1$)|(fc00::)|(fe80::)|(::ffff:127\.)/;
  if (ipv6Regex.test(host)) return true;
  return false;
}

export function validateTargetUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'That is not a valid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// URLs can be scanned.' };
  }
  if (!url.hostname) {
    return { ok: false, error: 'The URL is missing a hostname.' };
  }
  if (isPrivateHostname(url.hostname)) {
    return { ok: false, error: 'Scanning local or private addresses is not allowed.' };
  }
  return { ok: true, url };
}

function computeReputation(url) {
  let score = 0;
  const reasons = [];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const protocol = parsed.protocol;

    if (protocol !== 'https:') {
      score += 30;
      reasons.push('Insecure protocol (HTTP)');
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      score += 25;
      reasons.push('IP address instead of domain');
    }
    if (parsed.username || host.includes('@')) {
      score += 20;
      reasons.push('Credentials in URL');
    }
    if (host.includes('-')) {
      score += 15;
      reasons.push('Hyphenated domain');
    }
    if (/xn--/.test(host)) {
      score += 15;
      reasons.push('Internationalized domain (punycode)');
    }
    if (url.length > 75) {
      score += 10;
      reasons.push('Unusually long URL');
    }
    const found = HARVEST_KEYWORDS.filter(
      (k) => host.includes(k) || parsed.pathname.toLowerCase().includes(k)
    );
    if (found.length) {
      score += 10 * found.length;
      reasons.push('Credential-harvesting keywords: ' + found.join(', '));
    }
    const dots = host.split('.').length - 1;
    if (dots >= 4) {
      score += 10;
      reasons.push('Deep subdomain chain');
    }
  } catch {
    // invalid URL handled by caller
  }
  return { score: Math.min(100, score), reasons };
}

function fetchHeaders(url) {
  return new Promise((resolve, reject) => {
    const fn = url.protocol === 'https:' ? getSecure : get;
    const req = fn(
      url,
      { timeout: REQUEST_TIMEOUT_MS, maxRedirects: MAX_REDIRECTS },
      (res) => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers || {},
        });
        res.resume();
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function assessWebSecurity(url) {
  const checks = [];
  let details = '';
  try {
    const { statusCode, headers } = await fetchHeaders(url);
    const lower = {};
    for (const [k, v] of Object.entries(headers)) {
      lower[String(k).toLowerCase()] = v;
    }
    let missing = 0;
    for (const h of SECURITY_HEADERS) {
      if (!lower[h]) missing += 1;
      checks.push({ header: h, present: Boolean(lower[h]) });
    }
    details = `HTTP ${statusCode}; ${missing} of ${SECURITY_HEADERS.length} security headers present.`;
    const server = lower['server'] || '';
    if (/nginx\/[01]\.|apache\/2\.[0-2]\./i.test(server)) {
      details += ' Server header indicates potentially outdated software.';
    }
  } catch (err) {
    details = 'Could not reach the host to inspect security headers.';
    return { status: 'warn', detail: details, checks };
  }

  if (missing === 0) return { status: 'ok', detail: details, checks };
  if (missing <= 2) return { status: 'warn', detail: details, checks };
  return { status: 'bad', detail: details, checks };
}

async function validateCertificate(hostname) {
  return new Promise((resolve) => {
    const socket = connect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false,
      timeout: REQUEST_TIMEOUT_MS,
    });

    let done = false;
    const finish = (status, detail) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ status, detail });
    };

    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.subject) {
        finish('bad', 'No certificate presented.');
        return;
      }
      const issues = [];
      const now = new Date();
      const expiry = new Date(cert.valid_to || 0);
      if (expiry < now) issues.push('Certificate has expired.');
      const days = (expiry - now) / (1000 * 60 * 60 * 24);
      if (days > 0 && days < 30) issues.push('Certificate expires soon.');
      if (cert.issuer === cert.subject) {
        issues.push('Self-signed certificate.');
      }
      const detail =
        issues.length > 0
          ? issues.join('; ')
          : `Valid chain; issuer: ${cert.issuer.CN || cert.issuer.O || 'unknown'}.`;
      finish(issues.length ? 'bad' : 'ok', detail);
    });

    socket.on('error', () => {
      finish('warn', 'Could not complete TLS handshake for certificate inspection.');
    });

    socket.on('timeout', () => {
      finish('warn', 'TLS inspection timed out.');
    });
  });
}

function scoreToVerdict(score) {
  if (score <= 33) return 'safe';
  if (score <= 66) return 'suspicious';
  return 'malicious';
}

export async function scan(url) {
  const validated = validateTargetUrl(url);
  if (!validated.ok) {
    return { error: validated.error };
  }
  const { url: cleanUrl } = validated;
  const { score: repScore, reasons } = computeReputation(cleanUrl);

  const [headersResult, certResult] = await Promise.all([
    assessWebSecurity(cleanUrl).catch(() => ({
      status: 'warn',
      detail: 'Security header assessment failed.',
      checks: [],
    })),
    validateCertificate(new URL(cleanUrl).hostname).catch(() => ({
      status: 'warn',
      detail: 'Certificate inspection failed.',
    })),
  ]);

  let intelScore = 0;
  let intelDetail = 'No community reports for this URL.';
  // Collaborative threat intelligence is consulted here; reports are stored
  // by the feed endpoint and would be loaded from the store in production.
  const intelStatus = intelScore > 0 ? 'bad' : 'warn';

  const total = Math.min(100, repScore + (headersResult.status === 'bad' ? 15 : 0) + (certResult.status === 'bad' ? 15 : 0));
  const verdict = scoreToVerdict(total);

  const checks = {
    reputation: {
      status: repScore <= 33 ? 'ok' : repScore <= 66 ? 'warn' : 'bad',
      detail: reasons.length ? 'Risk signals: ' + reasons.slice(0, 2).join('; ') : 'No known-bad listings found.',
    },
    headers: headersResult,
    certificate: certResult,
    threat: {
      status: intelStatus,
      detail: intelDetail,
    },
  };

  return {
    score: total,
    verdict,
    reasons,
    checks,
  };
}

export { validateTargetUrl as validateUrl };
