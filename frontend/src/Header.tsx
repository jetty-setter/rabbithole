import { Link, useLocation } from "react-router-dom";

export function Header({
  authed,
  username,
  onToggleSidebar,
  onUpload,
  onLogin,
  onLogout,
  query,
  setQuery,
}: {
  authed: boolean;
  username: string | null;
  onToggleSidebar: () => void;
  onUpload: () => void;
  onLogin: () => void;
  onLogout: () => void;
  query: string;
  setQuery: (s: string) => void;
}) {
  const { pathname } = useLocation();
  const onFeed = pathname === "/";
  const initial = username?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onToggleSidebar} aria-label="Toggle menu">
          ☰
        </button>
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
            <button className="btn-ghost" onClick={onLogout}>
              Sign out
            </button>
            <span className="avatar-sm" title={username ?? ""}>
              {initial}
            </span>
          </>
        ) : (
          <button className="btn-primary" onClick={onLogin}>
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
