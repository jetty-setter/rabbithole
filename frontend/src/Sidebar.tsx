import { Link, useLocation } from "react-router-dom";

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
}: {
  open: boolean;
  authed: boolean;
  isAdmin: boolean;
}) {
  const { pathname } = useLocation();
  const cls = (p: string) => (pathname === p ? "side-link active" : "side-link");

  return (
    <aside className={open ? "sidebar" : "sidebar collapsed"}>
      <Link to="/" className={cls("/")}>
        <IconWatch />
        Watch
      </Link>
      <Link to="/trending" className={cls("/trending")}>
        <IconTrending />
        Surfacing
      </Link>

      {authed && (
        <>
          <div className="side-sep" />
          <div className="side-label">Your warren</div>
          <Link to="/favorites" className={cls("/favorites")}>
            <IconHeart />
            Burrow
          </Link>
          <Link to="/mine" className={cls("/mine")}>
            <IconVideo />
            Your videos
          </Link>
          {isAdmin && (
            <Link to="/admin" className={cls("/admin")}>
              <IconAdmin />
              Admin
            </Link>
          )}
        </>
      )}
    </aside>
  );
}
