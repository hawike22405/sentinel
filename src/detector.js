import { URL } from 'node:url';
import { get } from 'node:http';
import { get as getSecure } from 'node:https';
import { connect, checkServerIdentity } from 'node:tls';
import { isIP, BlockList } from 'node:net';
import { Resolver } from 'node:dns/promises';

export const REQUEST_TIMEOUT_MS = 6000;
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);
const HARVEST_KEYWORDS = ['login', 'verify', 'secure', 'account', 'paypal', 'bank', 'update', 'signin', 'webscr', 'confirm'];
const SECURITY_HEADERS = ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'content-security-policy', 'referrer-policy', 'permissions-policy'];
const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
]) blocked.addSubnet(address, prefix, 'ipv6');

// Fail closed for non-global addresses, including mapped IPv4, NAT64 and tunnels.
export function isPrivateIp(ip) {
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) {
    const first = parseInt(ip.split(':')[0], 16);
    return !(first >= 0x2000 && first <= 0x3fff) || blocked.check(ip, 'ipv6');
  }
  return true;
}

export function validateTargetUrl(input) {
  let url;
  try { url = new URL(input); } catch { return { ok: false, error: 'That is not a valid URL.' }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'Only http:// and https:// URLs can be scanned.' };
  if (!url.hostname || url.hostname.length > 253 || url.href.length > 2048) return { ok: false, error: 'The URL is missing a valid hostname or is too long.' };
  if (!ALLOWED_PORTS.has(url.port)) return { ok: false, error: 'Only standard web ports (80, 443, 8080, 8443) can be scanned.' };
  // A URL with credentials can contain a password and creates ambiguous identity.
  if (url.username || url.password) return { ok: false, error: 'Remove usernames and passwords from the URL before scanning.' };
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host) || (isIP(host) && isPrivateIp(host))) {
    return { ok: false, error: 'Scanning local or private addresses is not allowed.' };
  }
  if (!isIP(host)) url.hostname = host;
  url.hash = '';
  return { ok: true, url };
}

// Resolve once with a cancellable DNS deadline; connect only to this validated address.
export async function resolveTarget(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return { address: host, family: isIP(host) };
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), REQUEST_TIMEOUT_MS);
  try {
    const answers = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const addresses = answers.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    if (addresses.some(isPrivateIp)) throw new Error('Target resolves to a private or reserved address.');
    if (!addresses.length) throw new Error('DNS resolution failed or timed out.');
    return { address: addresses[0], family: isIP(addresses[0]) };
  } finally { clearTimeout(timer); }
}

export function pinnedLookup(target) {
  return (_host, options, callback) => {
    if (options?.all) callback(null, [target]);
    else callback(null, target.address, target.family);
  };
}

export function computeReputation(input) {
  const url = new URL(input);
  const host = url.hostname;
  let score = 0;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };
  if (url.protocol !== 'https:') add(30, 'Unencrypted HTTP');
  if (isIP(host.replace(/^\[|\]$/g, ''))) add(25, 'IP address instead of domain');
  if (host.includes('-')) add(15, 'Hyphenated domain (weak signal)');
  if (/xn--/.test(host)) add(15, 'Internationalized domain (weak signal)');
  if (url.href.length > 75) add(10, 'Long URL (weak signal)');
  const found = HARVEST_KEYWORDS.filter(k => host.includes(k) || url.pathname.toLowerCase().includes(k));
  if (found.length) add(10 * found.length, 'Account-related keywords (not proof of phishing): ' + found.join(', '));
  if (host.split('.').length >= 5) add(10, 'Deep subdomain chain');
  return { score: Math.min(100, score), reasons };
}

export function fetchHeaders(url, target) {
  return new Promise((resolve, reject) => {
    // Disable pooling: each request must use its pinned DNS address.
    const req = (url.protocol === 'https:' ? getSecure : get)(url, {
      agent: false, lookup: pinnedLookup(target), maxHeaderSize: 16384,
      headers: { 'User-Agent': 'SentinelScanner/1.1', Accept: '*/*' },
      // Headers are observable even when TLS is invalid; never call them trusted content.
      ...(url.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
    }, res => {
      clearTimeout(timer);
      resolve({ statusCode: res.statusCode, headers: res.headers || {} });
      res.destroy(); // never download or execute the body or follow redirects
    });
    const timer = setTimeout(() => req.destroy(new Error('Request deadline exceeded')), REQUEST_TIMEOUT_MS);
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

export function assessHeaders({ statusCode, headers }) {
  const checks = SECURITY_HEADERS.map(header => ({ header, present: Boolean(headers[header]) }));
  const missing = checks.filter(c => !c.present).length;
  const redirected = statusCode >= 300 && statusCode < 400;
  const completed = statusCode >= 200 && statusCode < 300;
  return {
    status: !completed ? 'warn' : missing === 0 ? 'ok' : missing <= 2 ? 'warn' : 'bad',
    completed, statusCode, checks,
    detail: `HTTP ${statusCode}; ${checks.length - missing} of ${checks.length} security headers present.` +
      (redirected ? ' Redirect destination was not scanned.' : !completed ? ' This response may be an error or bot-blocking page.' : '') +
      ' Header presence does not prove a site is safe or its policies effective.',
  };
}

export function inspectCertificate(socket, hostname) {
  const cert = socket.getPeerCertificate(true);
  if (!cert?.subject) return { status: 'bad', completed: true, detail: 'No certificate presented.' };
  const expiry = new Date(cert.valid_to);
  const start = new Date(cert.valid_from);
  const days = (expiry - Date.now()) / 86400000;
  const identityError = checkServerIdentity(hostname, cert);
  const problems = [];
  if (!Number.isFinite(days) || days <= 0) problems.push('Certificate has expired or has invalid dates.');
  if (!Number.isFinite(start.getTime()) || start > Date.now()) problems.push('Certificate is not yet valid or has invalid dates.');
  if (identityError) problems.push('Certificate does not match the requested hostname.');
  if (!socket.authorized) problems.push(`Certificate chain is not trusted (${socket.authorizationError}).`);
  if (cert.bits && cert.bits < (cert.asn1Curve ? 256 : 2048)) problems.push('Certificate public key is below the configured strength threshold.');
  const info = {
    issuer: cert.issuer?.O || cert.issuer?.CN || 'unknown',
    expires: Number.isFinite(expiry.getTime()) ? expiry.toISOString().slice(0, 10) : null,
    chain: socket.authorized && !identityError ? 'Trusted by Node CA store' : 'Not trusted',
    fingerprint: cert.fingerprint256 || null,
    publicKeyBits: cert.bits || null, protocol: socket.getProtocol(),
    transparencyLog: 'Not checked', revocation: 'Not checked',
  };
  return {
    status: problems.length ? 'bad' : days < 30 ? 'warn' : 'ok', completed: true, info,
    detail: problems.length ? problems.join(' ') : `Hostname and chain valid; expires ${info.expires}.` +
      (days < 30 ? ' Expires within 30 days.' : '') + ' Revocation, transparency and CA key-generation integrity are not checked.',
  };
}

export function validateCertificate(url, target) {
  if (url.protocol !== 'https:') return Promise.resolve({ status: 'warn', completed: false, detail: 'Not checked: the submitted URL uses unencrypted HTTP.' });
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return new Promise(resolve => {
    let done = false;
    const socket = connect({ host, port: Number(url.port) || 443, ...(isIP(host) ? {} : { servername: host }),
      rejectUnauthorized: false, lookup: pinnedLookup(target) });
    const finish = result => {
      if (done) return;
      done = true; clearTimeout(timer); socket.destroy(); resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'warn', completed: false, detail: 'TLS inspection deadline exceeded.' }), REQUEST_TIMEOUT_MS);
    socket.on('secureConnect', () => {
      try { finish(inspectCertificate(socket, host)); }
      catch { finish({ status: 'warn', completed: false, detail: 'Certificate inspection failed.' }); }
    });
    socket.on('error', () => finish({ status: 'warn', completed: false, detail: 'TLS connection failed; certificate could not be inspected.' }));
    socket.on('close', () => finish({ status: 'warn', completed: false, detail: 'TLS connection closed before inspection.' }));
  });
}

export function buildResult(url, headers, certificate, communityReports = 0) {
  const { score: repScore, reasons } = computeReputation(url);
  const score = Math.min(100, repScore + (headers.status === 'bad' ? 15 : 0) + (certificate.status === 'bad' ? 15 : 0));
  const incomplete = !headers.completed || (url.protocol === 'https:' && !certificate.completed);
  return {
    score, // A heuristic risk index, never a calibrated probability.
    verdict: incomplete ? 'unknown' : score <= 33 ? 'safe' : score <= 66 ? 'suspicious' : 'malicious',
    assessment: incomplete ? 'incomplete' : 'limited',
    scoreVersion: 'heuristic-v2',
    riskBreakdown: { urlPatterns: repScore, headers: headers.status === 'bad' ? 15 : 0, certificate: certificate.status === 'bad' ? 15 : 0, totalCap: 100 },
    limitations: ['No live threat database lookup, page-content analysis or malware execution.',
      'No vulnerability scan, certificate transparency or revocation verification.',
      'A low score is not a guarantee of safety. Anonymous reports are unverified and do not affect the score.'],
    reasons,
    checks: {
      reputation: { status: repScore <= 33 ? 'ok' : repScore <= 66 ? 'warn' : 'bad',
        detail: reasons.length ? 'URL heuristics: ' + reasons.join('; ') : 'No URL-pattern risk signals. No live reputation database was checked.' },
      headers, certificate,
      threat: { status: 'warn', count: communityReports, verified: false,
        detail: `${communityReports} unverified community report(s). Reports are not proof of a threat and do not change the risk score.` },
    },
  };
}

export async function scan(input, { communityReports = 0 } = {}) {
  const validated = validateTargetUrl(input);
  if (!validated.ok) return { error: validated.error };
  const url = validated.url;
  let target;
  try { target = await resolveTarget(url.hostname); }
  catch (err) {
    if (/private|reserved/.test(err.message)) return { error: err.message };
    return buildResult(url, { status: 'warn', completed: false, checks: [], detail: 'DNS failed; HTTP headers could not be inspected.' },
      { status: 'warn', completed: false, detail: 'DNS failed; certificate could not be inspected.' }, communityReports);
  }
  const [headers, certificate] = await Promise.all([
    fetchHeaders(url, target).then(assessHeaders).catch(() => ({ status: 'warn', completed: false, checks: [], detail: 'HTTP inspection failed or timed out.' })),
    validateCertificate(url, target),
  ]);
  return buildResult(url, headers, certificate, communityReports);
}

export { validateTargetUrl as validateUrl };
