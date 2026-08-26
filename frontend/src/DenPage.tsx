import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";
import { SkeletonFeed } from "./Skeleton";

/** Your hub — uploads, saves, trail, and a couple of stats in one place. */
export function DenPage() {
  const { videos, username, authed, requireLogin, favorites, hopped, trail, loading } = useApp();

  const mine = useMemo(
    () => videos.filter((v) => v.owner === username),
    [videos, username],
  );

  if (!authed) {
    return (
      <main className="page">
        <div className="empty">
          <h3>Dashboard</h3>
          <p>Sign in to see your uploads, saves, and trail in one place.</p>
          <button className="btn-primary" onClick={requireLogin}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (loading && mine.length === 0) return <SkeletonFeed />;

  const recent = mine
    .filter((v) => v.status === "ready" && !!v.playback_url)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 4);

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Dashboard</h1>
        <p>Everything that's yours, in one burrow.</p>
      </div>

      <div className="den-stats">
        <Link to="/mine" className="den-stat">
          <span className="den-num">{mine.length}</span>
          <span className="den-label">Uploads</span>
        </Link>
        <Link to="/favorites" className="den-stat">
          <span className="den-num">{favorites.size}</span>
          <span className="den-label">Saved</span>
        </Link>
        <Link to="/trail" className="den-stat">
          <span className="den-num">{trail.length}</span>
          <span className="den-label">On your trail</span>
        </Link>
        <div className="den-stat den-stat-static">
          <span className="den-num">{hopped.size}</span>
          <span className="den-label">Hops given</span>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div className="section-head">
            <h2>Your latest</h2>
          </div>
          <div className="grid">
            {recent.map((v) => (
              <VideoCard key={v.video_id} v={v} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
