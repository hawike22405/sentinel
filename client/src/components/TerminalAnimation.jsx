import { useEffect, useRef, useState } from 'react';

const TERMINAL_LINES = [
  { text: 'sentinel@cli:~$ ./scan --target example.com --deep', delay: 400 },
  { text: '  [1/4] threat analysis: no known-bad listings found', delay: 600 },
  { text: '  [2/4] web security: strict-transport-security missing', delay: 600 },
  { text: '  [3/4] certificate: valid chain — issuer Sectigo R3', delay: 600 },
  { text: '  [4/4] threat intelligence: 0 community reports', delay: 600 },
  { text: 'sentinel@cli:~$ scan complete — risk score: 0 (safe)', delay: 800 },
  { text: '', delay: 1200 },
  { text: 'sentinel@cli:~$ ./scan --target secure-account-login-verify-paypal.example.com --deep', delay: 400 },
  { text: '  [1/4] threat analysis: 5 credential-harvesting keywords detected', delay: 600 },
  { text: '  [2/4] web security: multiple headers missing', delay: 600 },
  { text: '  [3/4] certificate: self-signed intermediate', delay: 600 },
  { text: '  [4/4] threat intelligence: 2 community reports in 24h', delay: 600 },
  { text: 'sentinel@cli:~$ scan complete — risk score: 89 (malicious)', delay: 800 },
];

export default function TerminalAnimation() {
  const [lines, setLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const containerRef = useRef(null);

  useEffect(() => {
    if (!isTyping) return;

    const timer = setTimeout(() => {
      setLines((prev) => {
        const currentLine = TERMINAL_LINES[currentLineIndex];
        if (currentCharIndex < currentLine.text.length) {
          return prev + currentLine.text[currentCharIndex];
        }
        return prev;
      });
      setCurrentCharIndex((prev) => {
        if (prev < TERMINAL_LINES[currentLineIndex].text.length) {
          return prev + 1;
        }
        return 0;
      });
      setCurrentLineIndex((prev) => {
        if (prev >= TERMINAL_LINES.length - 1) {
          return 0;
        }
        return prev + (currentCharIndex >= TERMINAL_LINES[prev].text.length ? 1 : 0);
      });
    }, currentCharIndex === 0 ? TERMINAL_LINES[currentLineIndex].delay : 40);

    return () => clearTimeout(timer);
  }, [currentLineIndex, currentCharIndex, isTyping]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="terminal-wrap" ref={containerRef}>
      <div className="terminal">
        <div className="terminal-header">
          <div className="terminal-dots">
            <div className="dot dot--red" />
            <div className="dot dot--yellow" />
            <div className="dot dot--green" />
          </div>
          <div className="terminal-title">sentinel — threat scan</div>
        </div>
        <div className="terminal-body">
          <div className="terminal-line">
            <span className="prompt">sentinel@cli:~$</span>
            <span className="typing">{lines}</span>
            <span className="cursor">█</span>
          </div>
        </div>
      </div>
    </div>
  );
}
