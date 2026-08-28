import { Link } from "react-router-dom";

const FOOTER_LINKS: { label: string; to: string }[] = [
  { label: "Discover", to: "/" },
  { label: "Tunnels", to: "/tunnels" },
  { label: "Map", to: "/map" },
  { label: "Trail", to: "/trail" },
  { label: "Fresh", to: "/fresh" },
  { label: "Trending", to: "/trending" },
];

/** Restrained, editorial end-credit footer -- rendered once in the app
 *  layout, after every routed page. No columns, no newsletter, no social
 *  clutter: wordmark + tagline, a compact nav, and a quiet copyright line. */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div className="footer-brand">
            <Link to="/" className="logo">
              <img src="/rabbit-hole-logo.png" alt="RabbitHole" className="footer-logo" />
            </Link>
            <p className="footer-tagline">
              Follow curiosity deeper<span className="home-punct">.</span>
            </p>
          </div>
          <nav className="footer-nav">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="site-footer-bottom">© 2026 RabbitHole</div>
      </div>
    </footer>
  );
}
