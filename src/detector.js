import { URL } from 'node:url';
import { get } from 'node:http';
import { get as getSecure } from 'node:https';
import { connect } from 'node:tls';
import { isIP } from 'node:net';
import { lookup as dnsLookup, promises as dnsPromises } from 'node:dns';

const REQUEST_TIMEOUT_MS = 6000;

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

// True for loopback, private, link-local, CGNAT, multicast and reserved addresses.
export function isPrivateIp(ip) {
  const family = isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (family === 6) {
    const v6 = ip.toLowerCase();
    return (
      v6 === '::' || v6 === '::1' ||
      v6.startsWith('::ffff:') || // IPv4-mapped: block conservatively
      /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6)
    );
  }
  return false;
}

function isPrivateHostname(host) {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.local') || bare.endsWith('.internal')) return true;
  return isIP(bare) !== 0 && isPrivateIp(bare);
}

// DNS lookup that refuses private results. Passed to http/tls so the address that
// is validated is the address that is connected to (blocks DNS rebinding).
function publicOnlyLookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return callback(err);
    const ok = addrs.filter((a) => !isPrivateIp(a.address));
    if (!ok.length) return callback(new Error('Target resolves to a private address.'));
    if (options && options.all) return callback(null, ok);
    callback(null, ok[0].address, ok[0].family);
  });
}

async function resolvesToPrivate(hostname) {
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) return false; // literals checked by validateTargetUrl
  try {
    const addrs = await dnsPromises.lookup(hostname, { all: true });
    return addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return false; // unresolvable hosts are still scored by heuristics
  }
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

function computeReputation(input) {
  const url = String(input);
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
    if (parsed.username) {
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
    const secure = url.protocol === 'https:';
    const req = (secure ? getSecure : get)(
      url,
      {
        timeout: REQUEST_TIMEOUT_MS,
        lookup: publicOnlyLookup,
        headers: { 'User-Agent': 'SentinelScanner/1.0', Accept: '*/*' },
        ...(secure ? { rejectUnauthorized: false } : {}), // certificate is judged separately
      },
      (res) => {
        resolve({ statusCode: res.statusCode, headers: res.headers || {} });
        res.destroy(); // headers are enough; do not download the body
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

async function assessWebSecurity(url) {
  const checks = [];
  let missing = 0; // declared outside try: it is read after the try/catch
  let details = '';
  try {
    const { statusCode, headers } = await fetchHeaders(url);
    for (const h of SECURITY_HEADERS) {
      const present = Boolean(headers[h]); // Node lower-cases incoming header names
      if (!present) missing += 1;
      checks.push({ header: h, present });
    }
    details = `HTTP ${statusCode}; ${SECURITY_HEADERS.length - missing} of ${SECURITY_HEADERS.length} security headers present.`;
    if (/nginx\/[01]\.|apache\/2\.[0-2]\./i.test(headers.server || '')) {
      details += ' Server header indicates potentially outdated software.';
    }
  } catch {
    return { status: 'warn', detail: 'Could not reach the host to inspect security headers.', checks };
  }
  if (missing === 0) return { status: 'ok', detail: details, checks };
  if (missing <= 2) return { status: 'warn', detail: details, checks };
  return { status: 'bad', detail: details, checks };
}

function validateCertificate(url) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const port = url.protocol === 'https:' && url.port ? Number(url.port) : 443;
  return new Promise((resolve) => {
    let done = false;
    const socket = connect({
      host: hostname,
      port,
      ...(isIP(hostname) ? {} : { servername: hostname }),
      rejectUnauthorized: false, // inspect, never trust: validity is evaluated below
      lookup: publicOnlyLookup,
      timeout: REQUEST_TIMEOUT_MS,
    });
    const finish = (status, detail, info) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ status, detail, ...(info ? { info } : {}) });
    };

    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate(true);
      if (!cert || !cert.subject) return finish('bad', 'No certificate presented.');
      const expiry = new Date(cert.valid_to);
      const days = (expiry - Date.now()) / 86400000;
      const selfSigned = Boolean(cert.issuerCertificate) && cert.issuerCertificate.fingerprint256 === cert.fingerprint256;
      const info = {
        issuer: cert.issuer.O || cert.issuer.CN || 'unknown',
        expires: Number.isNaN(expiry.getTime()) ? null : expiry.toISOString().slice(0, 10),
        chain: socket.authorized ? 'Valid' : 'Not trusted',
        fingerprint: cert.fingerprint256 || null,
      };
      const problems = [];
      if (Number.isNaN(days) || days <= 0) problems.push('Certificate has expired.');
      if (selfSigned) problems.push('Self-signed certificate.');
      else if (!socket.authorized) problems.push(`Certificate is not trusted (${socket.authorizationError}).`);
      if (problems.length) return finish('bad', problems.join(' '), info);
      if (days < 30) return finish('warn', `Certificate is valid but expires in ${Math.floor(days)} days.`, info);
      finish('ok', `Trusted chain; issuer: ${info.issuer}; expires ${info.expires}.`, info);
    });
    socket.on('error', () => finish('warn', 'No HTTPS service, or the TLS handshake failed.'));
    socket.on('timeout', () => finish('warn', 'TLS inspection timed out.'));
  });
}

function scoreToVerdict(score) {
  if (score <= 33) return 'safe';
  if (score <= 66) return 'suspicious';
  return 'malicious';
}

export async function scan(url, { communityReports = 0 } = {}) {
  const validated = validateTargetUrl(url);
  if (!validated.ok) return { error: validated.error };
  const { url: cleanUrl } = validated;
  if (await resolvesToPrivate(cleanUrl.hostname)) {
    return { error: 'Scanning local or private addresses is not allowed.' };
  }
  const { score: repScore, reasons } = computeReputation(cleanUrl);

  const [headersResult, certResult] = await Promise.all([
    assessWebSecurity(cleanUrl).catch(() => ({ status: 'warn', detail: 'Security header assessment failed.', checks: [] })),
    validateCertificate(cleanUrl).catch(() => ({ status: 'warn', detail: 'Certificate inspection failed.' })),
  ]);

  // Collaborative intelligence: reports submitted through /api/feed/report.
  const intelScore = Math.min(40, communityReports * 20);
  const threat = communityReports > 0
    ? { status: communityReports >= 2 ? 'bad' : 'warn', detail: `${communityReports} community report${communityReports === 1 ? '' : 's'} for this site.` }
    : { status: 'ok', detail: 'No community reports for this site.' };

  const total = Math.min(
    100,
    repScore + intelScore + (headersResult.status === 'bad' ? 15 : 0) + (certResult.status === 'bad' ? 15 : 0)
  );

  return {
    score: total,
    verdict: scoreToVerdict(total),
    reasons,
    checks: {
      reputation: {
        status: repScore <= 33 ? 'ok' : repScore <= 66 ? 'warn' : 'bad',
        detail: reasons.length ? 'Risk signals: ' + reasons.slice(0, 2).join('; ') : 'No suspicious patterns found.',
      },
      headers: headersResult,
      certificate: certResult,
      threat,
    },
  };
}

export { validateTargetUrl as validateUrl };
