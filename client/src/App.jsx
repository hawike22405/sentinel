import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle';
import CustomCursor from './components/CustomCursor';
import PageBackground from './components/PageBackground';
import Hero from './components/Hero';
import Pillars from './components/Pillars';
import ScanResult from './components/ScanResult';
import ThreatFeed from './components/ThreatFeed';
import Footer from './components/Footer';

export default function App() {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-loading');
    document.body.classList.add('is-loading');

    const preload = document.getElementById('page-preload');
    const finishLoad = () => {
      if (preload) {
        preload.classList.add('fade-out');
        setTimeout(() => preload.remove(), 600);
      }
      html.classList.remove('is-loading');
      document.body.classList.remove('is-loading');
      const finePointer = window.matchMedia('(pointer: fine)').matches;
      if (finePointer) html.classList.add('m-cursor');
    };

    const timer = setTimeout(finishLoad, 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div id="page-preload" className="page-preload">
        <div className="loader-mark" aria-hidden="true" />
      </div>
      <div className="cursor-dot" id="cursor-dot" aria-hidden="true" />
      <div className="cursor-outline" id="cursor-outline" aria-hidden="true" />
      <CustomCursor />
      <PageBackground />
      <nav className="nav">
        <div className="wrap">
          <a href="#" className="brand" aria-label="Sentinel home">
            <span className="mark" aria-hidden="true">●</span>
            Sentinel
          </a>
          <div className="nav-actions">
            <ThemeToggle />
            <a href="#scan" className="btn btn--accent">Scan a link</a>
          </div>
        </div>
      </nav>
      <main id="top">
        <Hero onScanComplete={setScanResult} />
        <Pillars />
        <ScanResult result={scanResult} />
        <ThreatFeed />
      </main>
      <footer className="footer">
        <div className="container">
          <a href="#" className="brand" aria-label="Sentinel">
            <span className="mark">S</span>
            Sentinel
          </a>
          <p>
            &copy; 2026 Sentinel. Presentation layer only &mdash; no live
            scanning, no user data stored. See PRD.md for scope.
          </p>
        </div>
      </footer>
    </>
  );
}
