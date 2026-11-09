import { useEffect, useRef } from 'react';
import { mountChecksCarousel } from '../checks-carousel.js';

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
  const carouselRef = useRef(null);
  useEffect(() => mountChecksCarousel(carouselRef.current), []);

  return (
    <section className="section pillars" id="how-it-works" aria-labelledby="pillars-h">
      <div className="container">
        <h2 id="pillars-h">Four checks in one scan</h2>
        <div ref={carouselRef}
             style={{ width: '100vw', height: '70vh', marginLeft: 'calc(50% - 50vw)' }} />
        <ul className="sr-only">
          {pillars.map(p => (
            <li key={p.title}>
              <strong>{p.title}</strong>: <span dangerouslySetInnerHTML={{ __html: p.desc }} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
