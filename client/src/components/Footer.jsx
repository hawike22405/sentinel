export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <a href="#" className="brand" aria-label="Sentinel">
          <span className="mark" aria-hidden="true">●</span>
          Sentinel
        </a>
        <p>
          &copy; 2026 Sentinel. Presentation layer only &mdash; no live
          scanning, no user data stored. See PRD.md for scope.
        </p>
      </div>
    </footer>
  );
}
