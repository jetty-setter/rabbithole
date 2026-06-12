import { Link, useLocation } from "react-router-dom";

const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M9 4.5v15" />
  </svg>
);

const IconShuffle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

const IconWatch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none" />
  </svg>
);

const IconTrending = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
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

export function Sidebar({
  open,
  authed,
  isAdmin,
  onToggle,
  onTumble,
}: {
  open: boolean;
  authed: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onTumble: () => void;
}) {
  const { pathname } = useLocation();
  const cls = (p: string) => (pathname === p ? "side-link active" : "side-link");

  return (
    <aside className={open ? "sidebar" : "sidebar collapsed"}>
      <button
        className="side-toggle"
        onClick={onToggle}
        aria-label={open ? "Collapse menu" : "Expand menu"}
        title={open ? "Collapse menu" : "Expand menu"}
      >
        <IconMenu />
      </button>

      <Link to="/" className={cls("/")}>
        <IconWatch />
        <span className="side-text">Watch</span>
      </Link>
      <Link to="/trending" className={cls("/trending")}>
        <IconTrending />
        <span className="side-text">Surfacing</span>
      </Link>

      {authed && (
        <>
          <div className="side-sep" />
          <div className="side-label">Your warren</div>
          <Link to="/favorites" className={cls("/favorites")}>
            <IconHeart />
            <span className="side-text">Burrow</span>
          </Link>
          <Link to="/mine" className={cls("/mine")}>
            <IconVideo />
            <span className="side-text">Your videos</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className={cls("/admin")}>
              <IconAdmin />
              <span className="side-text">Admin</span>
            </Link>
          )}
        </>
      )}

      <button
        className="side-tumble"
        onClick={onTumble}
        title="Jump to a random video"
      >
        <IconShuffle />
        <span className="side-text">Tumble</span>
      </button>
    </aside>
  );
}
