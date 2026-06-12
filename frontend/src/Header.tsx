import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Avatar } from "./Avatar";

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
  const { pathname } = useLocation();
  const onFeed = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/" className="logo">
          <img src="/RHRabbit.png?v=4" alt="" className="logo-bunny" />
          <img src="/RHWordmark.png?v=4" alt="RabbitHole" className="logo-wordmark" />
        </Link>
      </div>

      {onFeed && (
        <input
          className="nav-search"
          placeholder="Search videos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
                      Your Burrow
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
