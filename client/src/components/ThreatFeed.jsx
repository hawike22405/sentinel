import { useEffect, useRef, useState } from 'react';

function timeAgo(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(secs)) return '';
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

export default function ThreatFeed() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const feedListRef = useRef(null);
  const reportMsgRef = useRef(null);
  const reportUrlRef = useRef(null);

  const loadFeed = async () => {
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error('feed unavailable');
      const data = await res.json();
      setReports(data.reports || []);
      setError('');
    } catch {
      setError('The threat feed is unavailable. Start the backend with npm start.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportMsgRef.current) return;
    reportMsgRef.current.className = 'form-error';
    reportMsgRef.current.textContent = '';
    const url = reportUrlRef.current.value.trim();
    if (!url) {
      reportMsgRef.current.textContent = 'Enter the website address to report.';
      return;
    }
    let reportUrl = url;
    if (!/^https?:\/\//i.test(reportUrl)) reportUrl = 'https://' + reportUrl;
    try {
      const res = await fetch('/api/feed/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: reportUrl, type: document.getElementById('report-type').value }),
      });
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(body.error || 'Report failed.');
      reportMsgRef.current.className = 'form-error form-ok';
      reportMsgRef.current.textContent = 'Thank you. Your report was added.';
      reportUrlRef.current.value = '';
      loadFeed();
    } catch (err) {
      reportMsgRef.current.textContent = err.message;
    }
  };

  const badgeMap = {
    safe: 'badge--safe',
    suspicious: 'badge--suspicious',
    malicious: 'badge--malicious',
  };

  return (
    <section className="section section--short" id="threat-feed" aria-labelledby="feed-h">
      <div className="container">
        <h2 id="feed-h">Threat feed</h2>
        <p>Recently reported threats from the collaborative intelligence network.</p>
        <div className="feed" ref={feedListRef} aria-live="polite">
          {loading && <p className="meta">Loading reports&hellip;</p>}
          {!loading && error && <p className="meta">{error}</p>}
          {!loading && !error && reports.length === 0 && (
            <p className="meta">No community reports yet. Be the first to report a suspicious site.</p>
          )}
          {!loading && !error && reports.map((r) => (
            <div key={r.id} className="feed-item">
              <div className="info">
                <div className="url">{r.url}</div>
                <span className="meta mono">
                  {r.type} &middot; {timeAgo(r.created_at)} &middot; {r.source}
                </span>
              </div>
              <span className={`badge ${badgeMap[r.verdict] || 'badge--suspicious'}`}>Reported</span>
            </div>
          ))}
        </div>
        <form id="report-form" className="input-group report-form" novalidate onSubmit={handleSubmit}>
          <label htmlFor="report-url" className="sr-only">Website URL to report</label>
          <input ref={reportUrlRef} id="report-url" className="input" type="url" placeholder="https://suspicious-site.example" required />
          <label htmlFor="report-type" className="sr-only">Report type</label>
          <select id="report-type" className="input">
            <option value="phishing">Phishing</option>
            <option value="scam">Scam</option>
            <option value="malware">Malware</option>
            <option value="impersonation">Impersonation</option>
            <option value="other">Other</option>
          </select>
          <button type="submit" className="btn btn--accent">Report site</button>
        </form>
        <div id="report-msg" ref={reportMsgRef} className="form-error" role="status" aria-live="polite"></div>
      </div>
    </section>
  );
}
