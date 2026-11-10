// Run on the machine hosting the backend: npm run diagnose -- https://github.com/
import '../src/env.js';
import { scan, validateUrl } from '../src/detector.js';
const input = process.argv[2] || 'https://github.com/';
const target = validateUrl(input);
if (!target.ok) {
  console.error(target.error);
  process.exitCode = 1;
} else {
  console.log('Testing the Node.js scanner from this computer (not browser connectivity).');
  console.log('Submitted origin:', target.url.origin);
  console.log('Scanner version: heuristic-v2-redirects');
  console.log('Proxy environment configured:', ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY'].some(k => Boolean(process.env[k])));
  const started = Date.now();
  const result = await scan(target.url);
  console.log(JSON.stringify({ durationMs: Date.now() - started, error: result.error,
    verdict: result.verdict, inspectedOrigin: result.inspectedOrigin, redirects: result.redirects,
    headers: result.checks?.headers, certificate: result.checks?.certificate }, null, 2));
  if (result.error || result.verdict === 'unknown') {
    console.log('Connection failed or inspection incomplete. A browser opening GitHub does not prove Node.js has the same network access.');
    console.log('Check firewall/VPN/DNS settings and whether your network requires a proxy. This direct scanner does not use a forward proxy; run it on a host with direct outbound DNS and web access.');
    console.log('Do not disable private-address protection or TLS verification to hide a connection error.');
    process.exitCode = 1;
  }
}
