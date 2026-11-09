const pillars = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    title: 'Threat analysis',
    desc: 'Known-bad lists, reputation signals, and suspicious patterns such as look-alike domains and credential-harvesting keywords.',
  },
  {
    icon: (
      <>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
      </>
    ),
    title: 'Web security',
    desc: 'HTTP security headers, exposed services, and software freshness &mdash; weak configurations raise the risk score.',
  },
  {
    icon: (
      <>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
      </>
    ),
    title: 'Certificate validation',
    desc: 'TLS chain, expiry, transparency logs, and cryptographic strength. Weak certificates undermine the trust indicator.',
  },
  {
    icon: (
      <>
        <path d="M20 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14v-2" />
        <path d="M13 13V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
      </>
    ),
    title: 'Threat intelligence',
    desc: 'Community-reported threats with source and date, so newly spotted phishing pages are flagged faster than any single list.',
  },
];

export default function Pillars() {
  return (
    <section className="section pillars" id="how-it-works" aria-labelledby="pillars-h">
      <div className="container">
        <h2 id="pillars-h">Four checks in one scan</h2>
        <div className="grid grid--cols-3">
          {pillars.map((p, i) => (
            <article key={i} className="card-glass">
              <div className="icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {p.icon}
                </svg>
              </div>
              <h3>{p.title}</h3>
              <p dangerouslySetInnerHTML={{ __html: p.desc }} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
