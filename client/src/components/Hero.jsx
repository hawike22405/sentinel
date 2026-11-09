import { useEffect, useState } from 'react';
import TextLoop from './TextLoop';
import CurvedInput from './CurvedInput';

const HARVEST_KEYWORDS = [
  'login', 'verify', 'secure', 'account', 'paypal', 'bank',
  'update', 'signin', 'webscr', 'confirm',
];

function computeScore(url) {
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
      (k) => host.includes(k) || parsed.pathname.toLowerCase().includes(k),
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

export default function Hero({ onScanComplete }) {
  const [formError, setFormError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleSubmit = async (url) => {
    setFormError('');
    const raw = url.trim();
    if (!raw) {
      setFormError('Please enter a website URL.');
      return;
    }
    let urlStr = raw;
    if (!/^https?:\/\//i.test(urlStr)) urlStr = 'https://' + urlStr;
    try {
      new URL(urlStr);
    } catch {
      setFormError('That does not look like a valid URL.');
      return;
    }

    const btn = document.getElementById('scan-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Scanning\u2026';
    setIsScanning(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlStr }),
      });
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        throw new Error(body.error || 'Scan failed.');
      }
      if (onScanComplete) onScanComplete(body);
    } catch (err) {
      setFormError(err.message || 'Scan failed. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
      setIsScanning(false);
    }
  };

  return (
    <section className="hero" id="hero" aria-labelledby="hero-h">
      <div className="container split">
        <div className="text-first">
          <div className="kicker wave-ribbon">
            <TextLoop
              text="THREAT ANALYSIS • WEB SECURITY • CERTIFICATE VALIDATION • THREAT INTELLIGENCE"
              shape="wave"
              speed={50}
              curviness={25}
              fontSize={16}
              fontWeight={600}
              letterSpacing={2}
              uppercase
              ribbon
              ribbonColor="#6366f1"
              ribbonWidth={20}
              pauseOnHover
            />
          </div>
          <h1 id="hero-h">Verify links before you click.</h1>
          <p className="tagline">
            Sentinel checks reputation, page security, TLS certificates, and
            community reports in one scan &mdash; then gives you a plain-language
            verdict.
          </p>
          <div className="input-group">
            <CurvedInput
              placeholder="https://example.com/login"
              buttonText="Scan link"
              theme="dark"
              bend={28}
              height={64}
              width={560}
              onSubmit={handleSubmit}
              type="url"
              showButton
              showIcon
            />
          </div>
          <div id="form-error" className="form-error" role="alert" aria-live="polite">
            {formError}
          </div>
        </div>
      </div>
    </section>
  );
}
