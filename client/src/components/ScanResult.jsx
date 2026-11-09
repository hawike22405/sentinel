import { useEffect, useRef } from 'react';
import GlassSurface from './GlassSurface';

const badgeMap = {
  safe: 'badge--safe',
  suspicious: 'badge--suspicious',
  malicious: 'badge--malicious',
};

const iconPaths = {
  reputation: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  headers: (
    <>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" />
    </>
  ),
  certificate: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
      <path d="M12 16h.01" />
    </>
  ),
  threat: (
    <>
      <path d="M20 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14v-2" />
      <path d="M13 13V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
    </>
  ),
};

export default function ScanResult({ result }) {
  const needleRef = useRef(null);
  const scoreRef = useRef(null);
  const verdictRef = useRef(null);
  const explanationRef = useRef(null);
  const checkRefs = {
    reputation: useRef(null),
    headers: useRef(null),
    certificate: useRef(null),
    threat: useRef(null),
  };

  const addClass = (el, cls) => {
    cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  };
  const removeClass = (el, cls) => {
    cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  };

  const renderCheck = (checkEl, status, label, detail) => {
    if (!checkEl.current) return;
    const textEl = checkEl.current.querySelector('.text');
    const strong = textEl.querySelector('strong');
    const span = textEl.querySelector('span');
    removeClass(checkEl.current, 'check--ok check--warn check--bad');
    addClass(checkEl.current, 'check--' + status);
    strong.textContent = label;
    span.textContent = detail;
  };

  useEffect(() => {
    if (!result) return;
    const { score, verdict, checks } = result;
    const badge = badgeMap[verdict] || 'badge--suspicious';

    if (scoreRef.current) scoreRef.current.textContent = score;
    if (needleRef.current) {
      const rotateDeg = 45 + (score / 100) * 180;
      needleRef.current.style.transform = `translate(-50%, -100%) rotate(${rotateDeg}deg)`;
    }
    const verdictLabel = verdict.charAt(0).toUpperCase() + verdict.slice(1);
    if (verdictRef.current) {
      verdictRef.current.textContent = verdictLabel;
      verdictRef.current.className = 'badge ' + badge;
    }
    const firstDetail =
      (checks && checks.reputation && checks.reputation.detail) || '';
    if (explanationRef.current) {
      explanationRef.current.textContent =
        verdictLabel +
        ' ' +
        (firstDetail ? '\u2014 ' + firstDetail : 'No strong risk signals detected.');
    }

    renderCheck(
      checkRefs.reputation,
      checks.reputation.status,
      'Reputation',
      checks.reputation.detail,
    );
    renderCheck(
      checkRefs.headers,
      checks.headers.status,
      'Security headers',
      checks.headers.detail,
    );
    renderCheck(
      checkRefs.certificate,
      checks.certificate.status,
      'Certificate',
      checks.certificate.detail,
    );
    renderCheck(
      checkRefs.threat,
      checks.threat.status,
      'Threat intelligence',
      checks.threat.detail,
    );

    if (checks.certificate.info) {
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v || 'Unavailable';
      };
      set('cert-issuer', checks.certificate.info.issuer);
      set('cert-expires', checks.certificate.info.expires);
      set('cert-chain', checks.certificate.info.chain);
      set('cert-fingerprint', checks.certificate.info.fingerprint);
    }
  }, [result]);

  const emptyState = (
    <section className="section section--short" id="scan" aria-labelledby="scan-h">
      <div className="container result-wrap">
        <div className="result-card">
          <div className="gauge-wrap">
            <div className="gauge" id="gauge" />
            <div className="gauge-needle" ref={needleRef} />
            <div className="gauge-label" ref={scoreRef}>
              --
            </div>
          </div>
          <div className="gauge-legend" id="gauge-legend">
            <span>
              <span className="gauge-dot gauge-dot--success" /> Safe
            </span>
            <span>
              <span className="gauge-dot gauge-dot--warning" /> Suspicious
            </span>
            <span>
              <span className="gauge-dot gauge-dot--danger" /> Malicious
            </span>
          </div>
        </div>
        <GlassSurface width={560} height={240} borderRadius={16}>
          <h2>
            Scan result{' '}
            <span id="result-verdict" ref={verdictRef} className="badge badge--safe">
              --
            </span>
          </h2>
          <p id="result-explanation" ref={explanationRef}>
            Enter a URL above to run a live scan and see the verdict.
          </p>
          <div className="check check--ok" ref={checkRefs.reputation} id="check-reputation">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.reputation}
            </svg>
            <div className="text">
              <strong>Reputation</strong>
              <span>—</span>
            </div>
          </div>
          <div className="check check--warn" ref={checkRefs.headers} id="check-headers">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.headers}
            </svg>
            <div className="text">
              <strong>Security headers</strong>
              <span>—</span>
            </div>
          </div>
          <div className="check check--bad" ref={checkRefs.certificate} id="check-certificate">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.certificate}
            </svg>
            <div className="text">
              <strong>Certificate</strong>
              <span>—</span>
            </div>
          </div>
          <div className="check check--bad" ref={checkRefs.threat} id="check-threat-intel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.threat}
            </svg>
            <div className="text">
              <strong>Threat intelligence</strong>
              <span>—</span>
            </div>
          </div>
          <div className="cert-panel mt-6">
            <h3>Certificate details</h3>
            <div className="field">
              <span className="key">Issuer</span>
              <span className="val mono" id="cert-issuer">
                Not scanned
              </span>
            </div>
            <div className="field">
              <span className="key">Expires</span>
              <span className="val mono" id="cert-expires">
                Not scanned
              </span>
            </div>
            <div className="field">
              <span className="key">Chain</span>
              <span className="val mono" style={{ color: 'var(--color-warning)' }} id="cert-chain">—</span>
            </div>
            <div className="field">
              <span className="key">Transparency log</span>
              <span className="val mono">—</span>
            </div>
            <div className="field">
              <span className="key">Fingerprint (SHA-256)</span>
              <span className="val mono cert-fp" id="cert-fingerprint">
                a4&hellip;1f
              </span>
            </div>
          </div>
        </GlassSurface>
      </div>
    </section>
  );

  if (!result) {
    return emptyState;
  }

  const { score, verdict, checks } = result;
  const badge = badgeMap[verdict] || 'badge--suspicious';
  const verdictLabel = verdict.charAt(0).toUpperCase() + verdict.slice(1);

  return (
    <section className="section section--short" id="scan" aria-labelledby="scan-h">
      <div className="container result-wrap">
        <div className="result-card">
          <div className="gauge-wrap">
            <div className="gauge" id="gauge" />
            <div className="gauge-needle" ref={needleRef} />
            <div className="gauge-label" ref={scoreRef}>
              {score}
            </div>
          </div>
          <div className="gauge-legend" id="gauge-legend">
            <span>
              <span className="gauge-dot gauge-dot--success" /> Safe
            </span>
            <span>
              <span className="gauge-dot gauge-dot--warning" /> Suspicious
            </span>
            <span>
              <span className="gauge-dot gauge-dot--danger" /> Malicious
            </span>
          </div>
        </div>
        <GlassSurface width={560} height={240} borderRadius={16}>
          <h2>
            Scan result{' '}
            <span id="result-verdict" ref={verdictRef} className={`badge ${badge}`}>
              {verdictLabel}
            </span>
          </h2>
          <p id="result-explanation" ref={explanationRef}>
            {verdictLabel} &mdash;{' '}
            {(checks.reputation && checks.reputation.detail) ||
              'No strong risk signals detected.'}
          </p>
          <div className="check check--ok" ref={checkRefs.reputation} id="check-reputation">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.reputation}
            </svg>
            <div className="text">
              <strong>Reputation</strong>
              <span>{checks.reputation.detail}</span>
            </div>
          </div>
          <div className="check check--warn" ref={checkRefs.headers} id="check-headers">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.headers}
            </svg>
            <div className="text">
              <strong>Security headers</strong>
              <span>{checks.headers.detail}</span>
            </div>
          </div>
          <div className="check check--bad" ref={checkRefs.certificate} id="check-certificate">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.certificate}
            </svg>
            <div className="text">
              <strong>Certificate</strong>
              <span>{checks.certificate.detail}</span>
            </div>
          </div>
          <div className="check check--bad" ref={checkRefs.threat} id="check-threat-intel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {iconPaths.threat}
            </svg>
            <div className="text">
              <strong>Threat intelligence</strong>
              <span>{checks.threat.detail}</span>
            </div>
          </div>
          <div className="cert-panel mt-6">
            <h3>Certificate details</h3>
            <div className="field">
              <span className="key">Issuer</span>
              <span className="val mono" id="cert-issuer">
                {checks.certificate.info?.issuer || 'Not scanned'}
              </span>
            </div>
            <div className="field">
              <span className="key">Expires</span>
              <span className="val mono" id="cert-expires">
                {checks.certificate.info?.expires || 'Not scanned'}
              </span>
            </div>
            <div className="field">
              <span className="key">Chain</span>
              <span className="val mono" style={{ color: 'var(--color-warning)' }} id="cert-chain">
                {checks.certificate.info?.chain || 'Not scanned'}
              </span>
            </div>
            <div className="field">
              <span className="key">Transparency log</span>
              <span className="val mono">{checks.certificate.info?.transparencyLog || 'Not scanned'}</span>
            </div>
            <div className="field">
              <span className="key">Fingerprint (SHA-256)</span>
              <span className="val mono cert-fp" id="cert-fingerprint">
                {checks.certificate.info?.fingerprint || 'Not scanned'}
              </span>
            </div>
          </div>
        </GlassSurface>
      </div>
    </section>
  );
}
