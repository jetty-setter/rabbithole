import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.8-4.8" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

export function Header({
  authed,
  username,
  onUpload,
  onLogin,
  onSignup,
  onLogout,
  query,
  setQuery,
}: {
  authed: boolean;
  username: string | null;
  onUpload: () => void;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
  query: string;
  setQuery: (s: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term) {
      navigate(`/search?q=${encodeURIComponent(term)}`);
      setMobileSearchOpen(false);
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/" className="logo">
          <img src="/RHRabbit.png?v=5" alt="" className="logo-bunny" />
          <span className="logo-wordmark-text">RabbitHole</span>
        </Link>
      </div>

      <form className="nav-search-form" onSubmit={submitSearch} role="search">
        <input
          className="nav-search"
          placeholder="Search what's said…  ↵"
          title="Searches every video's transcript by meaning and jumps to the matching moment."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <button
        type="button"
        className="mobile-search-btn"
        onClick={() => setMobileSearchOpen(true)}
        aria-label="Search"
      >
        <IconSearch />
      </button>

      {mobileSearchOpen && (
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
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
            >
              <IconClose />
            </button>
          </form>
        </div>
      )}

      <nav className="topnav">
        {authed ? (
          <>
            <button className="btn-primary" onClick={onUpload}>
              ＋ Upload
            </button>
            <div className="account">
              <button
                className="avatar-btn"
                onClick={() => setMenuOpen((o) => !o)}
                title={username ?? ""}
                aria-label="Account menu"
              >
                <Avatar name={username} />
              </button>
              {menuOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="account-menu">
                    <div className="menu-user">@{username}</div>
                    <Link to="/favorites" className="menu-item" onClick={() => setMenuOpen(false)}>
                      Saved
                    </Link>
                    <button
                      className="menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
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
      </nav>
    </header>
  );
}
