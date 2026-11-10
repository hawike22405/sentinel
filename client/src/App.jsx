import { useEffect, useState, useCallback } from 'react';
import RingsIntro from './components/RingsIntro';
import ThemeToggle from './components/ThemeToggle';
import CanvasCursor from './components/CanvasCursor';
import PageBackground from './components/PageBackground';
import Hero from './components/Hero';
import Pillars from './components/Pillars';
import ScanResult from './components/ScanResult';
import ThreatFeed from './components/ThreatFeed';
import Footer from './components/Footer';
import { FlameButton } from '@/components/ui/flame-button';

export default function App() {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('is-loading');
    document.body.classList.add('is-loading');
  }, []);

  const finishLoad = useCallback(() => {
    const html = document.documentElement;
    html.classList.remove('is-loading');
    document.body.classList.remove('is-loading');
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (finePointer) html.classList.add('m-cursor');
  }, []);

  return (
    <>
      <RingsIntro onFinish={finishLoad} />
      <CanvasCursor />
      <PageBackground />
      <nav className="nav">
        <div className="wrap">
          <a href="#" className="brand" aria-label="Sentinel home">
            <span className="mark" aria-hidden="true">●</span>
            Sentinel
          </a>
          <div className="nav-actions">
            <ThemeToggle />
            <FlameButton text="Scan a link" href="#hero" />
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
            &copy; 2026 Sentinel. Limited live HTTP and TLS assessment. Website origins and results
            are stored for up to 30 days. No guarantee of safety.
          </p>
        </div>
      </footer>
    </>
  );
}
