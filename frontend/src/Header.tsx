import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { MapIcon } from "./Icons";

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const IconWatch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none" />
  </svg>
);

const IconTunnels = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const IconTrail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 18l5-5 4 2 5-8" strokeDasharray="0.1 4" />
    <circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="10" cy="13" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="14" cy="15" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="7" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const IconFresh = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l1.7 5.6L19 9l-5.3 1.4L12 16l-1.7-5.6L5 9l5.3-1.4z" />
  </svg>
);

const IconTrending = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
  </svg>
);

const IconDen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </svg>
);

const IconHeart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
);

const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="2" y="5" width="14" height="14" rx="2.5" />
    <path d="M16 10l6-3v10l-6-3z" />
  </svg>
);

const IconAdmin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const navCls = ({ isActive }: { isActive: boolean }) => (isActive ? "navlink active" : "navlink");

export function Header({
  authed,
  username,
  isAdmin,
  onUpload,
  onLogin,
  onSignup,
  onLogout,
  onTumble,
  query,
  setQuery,
}: {
  authed: boolean;
  username: string | null;
  isAdmin: boolean;
  onUpload: () => void;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
  onTumble: () => void;
  query: string;
  setQuery: (s: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term) {
      navigate(`/search?q=${encodeURIComponent(term)}`);
      setSearchOpen(false);
    }
  }

  return (
    <header className="topbar">
      <Link to="/" className="logo">
        <img src="/rabbit-hole-logo.png" alt="RabbitHole" className="logo-mark" />
      </Link>

      <ul className="nav-center">
        <li>
          <NavLink to="/" end className={navCls}>
            Watch
          </NavLink>
        </li>
        <li>
          <NavLink to="/tunnels" className={navCls}>
            Tunnels
          </NavLink>
        </li>
        <li>
          <NavLink to="/map" className={navCls}>
            Map
          </NavLink>
        </li>
        <li>
          <NavLink to="/trail" className={navCls}>
            Trail
          </NavLink>
        </li>
        <li>
          <button type="button" className="tumble-action" onClick={onTumble} title="Take me somewhere.">
            <span className="tumble-action-glyph" aria-hidden="true">
              ↝
            </span>
            Tumble
          </button>
        </li>
      </ul>

      <div className="nav-right">
        <button type="button" className="nav-search-trigger" onClick={() => setSearchOpen(true)}>
          <IconSearch />
          <span className="nav-search-trigger-label">Search</span>
        </button>
        <span className="nav-sep" />

        {authed ? (
          <button type="button" className="nav-upload-link" onClick={onUpload}>
            Upload
          </button>
        ) : (
          <>
            <button className="btn-ghost" onClick={onLogin}>
              Sign in
            </button>
            <button className="btn-primary" onClick={onSignup}>
              Sign up
            </button>
          </>
        )}

        <div className="account">
          <button
            type="button"
            className="burger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            title={authed ? (username ?? "") : "Menu"}
            aria-label="Menu"
          >
            {authed ? <Avatar name={username} /> : <IconMenu />}
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="account-menu">
                {authed && <div className="menu-user">@{username}</div>}
                {/* Primary nav collapses out of the topbar below 720px -- mirror
                    it here so mobile visitors don't lose Tunnels/Map/Trail/Tumble. */}
                <div className="menu-mobile-primary">
                  <Link to="/" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <IconWatch />
                    Watch
                  </Link>
                  <Link to="/tunnels" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <IconTunnels />
                    Tunnels
                  </Link>
                  <Link to="/map" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <MapIcon />
                    Map
                  </Link>
                  <Link to="/trail" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <IconTrail />
                    Trail
                  </Link>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onTumble();
                    }}
                  >
                    <span className="tumble-action-glyph" aria-hidden="true">
                      ↝
                    </span>
                    Tumble
                  </button>
                  <div className="menu-sep" />
                </div>
                <Link to="/fresh" className="menu-item" onClick={() => setMenuOpen(false)}>
                  <IconFresh />
                  Fresh
                </Link>
                <Link to="/trending" className="menu-item" onClick={() => setMenuOpen(false)}>
                  <IconTrending />
                  Trending
                </Link>
                {authed && (
                  <>
                    <div className="menu-sep" />
                    <Link to="/den" className="menu-item" onClick={() => setMenuOpen(false)}>
                      <IconDen />
                      Dashboard
                    </Link>
                    <Link to="/favorites" className="menu-item" onClick={() => setMenuOpen(false)}>
                      <IconHeart />
                      Saved
                    </Link>
                    <Link to="/mine" className="menu-item" onClick={() => setMenuOpen(false)}>
                      <IconVideo />
                      Your videos
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" className="menu-item" onClick={() => setMenuOpen(false)}>
                        <IconAdmin />
                        Admin
                      </Link>
                    )}
                    <div className="menu-sep" />
                    <button
                      className="menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="mobile-search-overlay">
          <form className="mobile-search-form" onSubmit={submitSearch} role="search">
            <IconSearch />
            <input
              className="mobile-search-input"
              placeholder="Search what's said…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="mobile-search-close"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <IconClose />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
