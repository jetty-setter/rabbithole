import { Link, useLocation } from "react-router-dom";

const IconWatch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none" />
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

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export function Sidebar({
  open,
  authed,
  isAdmin,
  onUpload,
  onLogin,
}: {
  open: boolean;
  authed: boolean;
  isAdmin: boolean;
  onUpload: () => void;
  onLogin: () => void;
}) {
  const { pathname } = useLocation();
  return (
    <aside className={open ? "sidebar" : "sidebar collapsed"}>
      <Link to="/" className={pathname === "/" ? "side-link active" : "side-link"}>
        <IconWatch />
        Watch
      </Link>

      {isAdmin && (
        <Link to="/admin" className={pathname === "/admin" ? "side-link active" : "side-link"}>
          <IconAdmin />
          Admin
        </Link>
      )}

      <div className="side-sep" />

      {authed ? (
        <button className="side-link" onClick={onUpload}>
          <IconUpload />
          Upload
        </button>
      ) : (
        <button className="side-link" onClick={onLogin}>
          <IconUser />
          Sign in
        </button>
      )}

      <div className="side-foot">
        <span>RabbitHole — adaptive video, from the edge.</span>
        <a href="https://github.com/jetty-setter/rabbithole" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        <span>Built by Steph Simmons</span>
      </div>
    </aside>
  );
}
