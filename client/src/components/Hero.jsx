import { useEffect, useRef, useState } from 'react';
import { mountRibbon } from '../ribbon.js';
import CurvedInput from './CurvedInput';
import { Component as BoxLoader } from '@/components/ui/loader-3';

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
  const ribbonRef = useRef(null);

  useEffect(() => {
    const unmount = mountRibbon(ribbonRef.current,
      ['Threat analysis', 'Web security', 'Certificate validation', 'Threat intelligence']);
    return unmount;
  }, []);

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

    setIsScanning(true);

    const LOOP_DURATION_MS = 3000;
    const minLoopWait = new Promise((resolve) => setTimeout(resolve, LOOP_DURATION_MS));
    const scanPromise = fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr }),
    });

    try {
      const [res] = await Promise.all([scanPromise, minLoopWait]);
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        throw new Error(body.error || 'Scan failed.');
      }
      if (onScanComplete) {
        onScanComplete(body);
        setTimeout(() => {
          const scanSection = document.getElementById('scan');
          if (scanSection) {
            scanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
    } catch (err) {
      setFormError(err.message || 'Scan failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <section className="hero" id="hero" aria-labelledby="hero-h">
      {isScanning && (
        <div
          className="scan-loader-backdrop"
          role="status"
          aria-live="polite"
          aria-label="Analyzing URL security"
        >
          <div className="scan-loader-card">
            <BoxLoader />
            <div className="scan-loader-badge">
              <span className="scan-loader-pulse" aria-hidden="true" />
              Scanning Target Link
            </div>
            <h2 className="scan-loader-title">Analyzing Security Indicators</h2>
            <p className="scan-loader-desc">
              Checking TLS certificate integrity, reputation databases, and heuristic evasion patterns&hellip;
            </p>
          </div>
        </div>
      )}
      <div className="wave-ribbon" ref={ribbonRef} style={{ height: 150 }} aria-hidden="true" />
      <div className="container split">
        <div className="text-first">
          <h1 id="hero-h">Verify links before you click.</h1>
          <p className="tagline">
            Sentinel checks reputation, page security, TLS certificates, and
            community reports in one scan &mdash; then gives you a plain-language
            verdict.
          </p>
          <CurvedInput
              placeholder="https://example.com/login"
              buttonText={isScanning ? 'Scanning\u2026' : 'Scan link'}
              onSubmit={handleSubmit}
              disabled={isScanning}
              ariaLabel="Website URL"
            />
          <div id="form-error" className="form-error" role="alert" aria-live="polite">
            {formError}
          </div>
        </div>
      </div>
    </section>
  );
}
