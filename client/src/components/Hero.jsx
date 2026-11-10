import { useEffect, useRef, useState } from 'react';
import { mountRibbon } from '../ribbon.js';
import CurvedInput from './CurvedInput';
import { Component as BoxLoader } from '@/components/ui/loader-3';

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
      signal: AbortSignal.timeout(20000),
    });

    try {
      const [res] = await Promise.all([scanPromise, minLoopWait]);
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        throw new Error(body.error || 'Scan failed.');
      }
      if (!body.scoreVersion || !body.checks || !body.assessment) {
        throw new Error('The scanner backend is outdated. Please update and restart Sentinel.');
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
              Checking URL patterns, HTTP headers, TLS certificates, and unverified community reports&hellip;
            </p>
          </div>
        </div>
      )}
      <div className="wave-ribbon" ref={ribbonRef} style={{ height: 150 }} aria-hidden="true" />
      <div className="container split">
        <div className="text-first">
          <h1 id="hero-h">Verify links before you click.</h1>
          <p className="tagline">
            Sentinel checks URL patterns, HTTP headers, TLS certificates, and
            community reports in one scan &mdash; then gives you a plain-language
            risk assessment. A low score does not guarantee safety.
          </p>
          <p className="meta">Only the website origin is saved for 30 days. The submitted URL is contacted by the scanner. Avoid submitting private links.</p>
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
