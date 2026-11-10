import { URL } from 'node:url';
import { get } from 'node:http';
import { get as getSecure } from 'node:https';
import { connect, checkServerIdentity } from 'node:tls';
import { isIP, BlockList } from 'node:net';
import { Resolver } from 'node:dns/promises';

export const REQUEST_TIMEOUT_MS = 6000;
export const SCAN_TIMEOUT_MS = 15000;
export const MAX_REDIRECTS = 3;
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
export async function resolveTarget(hostname, { signal } = {}) {
  signal?.throwIfAborted();
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return { address: host, family: isIP(host) };
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const cancel = () => resolver.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, REQUEST_TIMEOUT_MS);
  try {
    const answers = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const addresses = answers.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    signal?.throwIfAborted();
    if (addresses.some(isPrivateIp)) throw Object.assign(new Error('Target resolves to a private or reserved address.'), { code: 'PRIVATE_TARGET' });
    if (!addresses.length) throw Object.assign(new Error('DNS resolution failed or timed out.'), { code: answers.find(r => r.status === 'rejected')?.reason?.code || 'ENOTFOUND' });
    return { address: addresses[0], family: isIP(addresses[0]) };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
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

export function fetchHeaders(url, target, { signal } = {}) {
  return new Promise((resolve, reject) => {
    // Disable pooling: each request must use its pinned DNS address.
    const req = (url.protocol === 'https:' ? getSecure : get)(url, {
      agent: false, lookup: pinnedLookup(target), maxHeaderSize: 16384, signal,
      headers: { 'User-Agent': 'SentinelScanner/1.1', Accept: '*/*' },
      // Headers are observable even when TLS is invalid; never call them trusted content.
      ...(url.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
    }, res => {
      clearTimeout(timer);
      resolve({ statusCode: res.statusCode, headers: res.headers || {} });
      res.destroy(); // never download or execute the body or follow redirects
    });
    const timer = setTimeout(() => req.destroy(Object.assign(new Error('Request deadline exceeded'), { code: 'ETIMEDOUT' })), REQUEST_TIMEOUT_MS);
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

export function validateCertificate(url, target, { signal } = {}) {
  if (url.protocol !== 'https:') return Promise.resolve({ status: 'warn', completed: false, detail: 'Not checked: the submitted URL uses unencrypted HTTP.' });
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return new Promise(resolve => {
    if (signal?.aborted) return resolve(connectionFailure('tls', signal.reason));
    let done = false;
    const socket = connect({ host, port: Number(url.port) || 443, ...(isIP(host) ? {} : { servername: host }),
      rejectUnauthorized: false, lookup: pinnedLookup(target) });
    const finish = result => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); socket.destroy(); resolve(result);
    };
    const abort = () => finish(connectionFailure('tls', signal.reason));
    const timer = setTimeout(() => finish(connectionFailure('tls', { code: 'ETIMEDOUT' })), REQUEST_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    socket.on('secureConnect', () => {
      try { finish(inspectCertificate(socket, host)); }
      catch { finish({ status: 'warn', completed: false, detail: 'Certificate inspection failed.' }); }
    });
    socket.on('error', err => finish(connectionFailure('tls', err)));
    socket.on('close', () => finish({ status: 'warn', completed: false, detail: 'TLS connection closed before inspection.' }));
  });
}

export function buildResult(url, headers, certificate, communityReports = 0, inspectionUrl = url) {
  const { score: repScore, reasons } = computeReputation(url);
  const score = Math.min(100, repScore + (headers.status === 'bad' ? 15 : 0) + (certificate.status === 'bad' ? 15 : 0));
  const incomplete = !headers.completed || (inspectionUrl.protocol === 'https:' && !certificate.completed);
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

// Only expose classified error codes, never raw socket/proxy details or response bodies.
export function connectionFailure(stage, error = {}) {
  const raw = error.code || error.name;
  let errorCode = 'CONNECTION_FAILED';
  let reason = 'The scanner could not establish a connection from the backend.';
  if (stage === 'dns') {
    errorCode = raw === 'ENOTFOUND' || raw === 'ENODATA' ? 'DNS_NOT_FOUND' : 'DNS_UNAVAILABLE';
    reason = errorCode === 'DNS_NOT_FOUND' ? 'The hostname could not be resolved.' : 'DNS resolution failed in the scanner backend. Check the computer’s DNS, VPN and firewall settings.';
  } else if (['ETIMEDOUT', 'ABORT_ERR', 'TimeoutError', 'AbortError', 'ECANCELLED'].includes(raw)) {
    errorCode = 'CONNECTION_TIMEOUT'; reason = 'The scanner connection timed out. The site or the backend network may be blocking the request.';
  } else if (['ENETUNREACH', 'EHOSTUNREACH', 'EACCES', 'EPERM'].includes(raw)) {
    errorCode = 'NETWORK_UNREACHABLE'; reason = 'The backend cannot reach this network. Check outbound access for Node.js, VPN or proxy requirements.';
  } else if (raw === 'ECONNREFUSED') {
    errorCode = 'CONNECTION_REFUSED'; reason = 'The connection was refused by the site or the backend network.';
  } else if (raw === 'ECONNRESET') {
    errorCode = 'CONNECTION_RESET'; reason = 'The connection was closed by the site or an intermediate network service.';
  } else if (raw === 'REDIRECT_BLOCKED' || raw === 'PRIVATE_TARGET') {
    errorCode = 'REDIRECT_BLOCKED'; reason = 'Scanning stopped because the destination is local, private, reserved or otherwise disallowed.';
  } else if (['REDIRECT_LIMIT', 'REDIRECT_LOOP'].includes(raw)) {
    errorCode = raw; reason = raw === 'REDIRECT_LOOP' ? 'The site redirects in a loop.' : 'The site exceeded the limit of three redirects.';
  }
  return { status: 'warn', completed: false, errorCode, stage, checks: [],
    detail: reason + ' This is an incomplete scan, not proof that the site is unsafe or has no HTTPS service.' };
}

// Follow at most three HTTP redirects. Validate and pin every hop before connecting.
// Dependencies are injectable only in local tests, never through an API request.
export async function requestTarget(input, { resolve = resolveTarget, fetch = fetchHeaders, signal } = {}) {
  let url = new URL(input);
  const redirects = [];
  const visited = new Set();
  while (true) {
    signal?.throwIfAborted();
    const validated = validateTargetUrl(url);
    if (!validated.ok) throw Object.assign(new Error('Redirect target is not allowed.'), { code: 'REDIRECT_BLOCKED', scanStage: 'http' });
    url = validated.url;
    if (visited.has(url.href)) throw Object.assign(new Error('Redirect loop.'), { code: 'REDIRECT_LOOP', scanStage: 'http' });
    visited.add(url.href);
    let target;
    try { target = await resolve(url.hostname, { signal }); }
    catch (err) { err.scanStage = 'dns'; throw err; }
    let response;
    try { response = await fetch(url, target, { signal }); }
    catch (err) { err.scanStage = 'http'; throw err; }
    if (![301, 302, 303, 307, 308].includes(response.statusCode) || !response.headers.location) return { url, target, response, redirects };
    if (redirects.length >= MAX_REDIRECTS) throw Object.assign(new Error('Too many redirects.'), { code: 'REDIRECT_LIMIT', scanStage: 'http' });
    let next;
    try { next = new URL(response.headers.location, url); }
    catch { throw Object.assign(new Error('Invalid redirect URL.'), { code: 'REDIRECT_BLOCKED', scanStage: 'http' }); }
    // A secure link must not silently downgrade to cleartext during scanning.
    if (url.protocol === 'https:' && next.protocol !== 'https:') throw Object.assign(new Error('Insecure redirect.'), { code: 'REDIRECT_BLOCKED', scanStage: 'http' });
    redirects.push({ from: url.origin, to: next.origin, statusCode: response.statusCode });
    url = next;
  }
}

export async function scan(input, { communityReports = 0 } = {}) {
  const validated = validateTargetUrl(input);
  if (!validated.ok) return { error: validated.error };
  const url = validated.url;
  const signal = AbortSignal.timeout(SCAN_TIMEOUT_MS);
  let observed;
  try { observed = await requestTarget(url, { signal }); }
  catch (err) {
    // The same SSRF guard covers initial resolution and every redirect destination.
    if (err.code === 'PRIVATE_TARGET') return { error: 'Target resolves to a private or reserved address.' };
    const failure = connectionFailure(err.scanStage || 'http', err);
    return buildResult(url, failure, { status: 'warn', completed: false, errorCode: 'NOT_INSPECTED',
      detail: 'Certificate not inspected because the destination could not be reached. This does not mean HTTPS is unavailable.' }, communityReports);
  }
  const headers = assessHeaders(observed.response);
  const certificate = await validateCertificate(observed.url, observed.target, { signal });
  const result = buildResult(url, headers, certificate, communityReports, observed.url);
  // Both submitted and final URL patterns matter after a redirect; use the stronger signal.
  if (observed.url.href !== url.href) {
    const destination = buildResult(observed.url, headers, certificate, communityReports);
    if (destination.score > result.score) {
      result.score = destination.score; result.riskBreakdown = destination.riskBreakdown;
      result.verdict = destination.verdict;
    }
    result.reasons = [...new Set([...result.reasons, ...destination.reasons])];
    result.checks.reputation.detail += ' Redirect destination URL patterns were also checked.';
  }
  result.inspectedOrigin = observed.url.origin;
  result.redirects = observed.redirects;
  return result;
}

export { validateTargetUrl as validateUrl };
