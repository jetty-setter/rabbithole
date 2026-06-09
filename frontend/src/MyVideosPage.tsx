import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";

export function MyVideosPage() {
  const { videos, authed, username, requireLogin } = useApp();

  const list = useMemo(
    () =>
      videos
        .filter((v) => v.owner === username)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [videos, username],
  );

  if (!authed) {
    return (
      <main className="page">
        <div className="empty">
          <h3>Your videos</h3>
          <p>Sign in to see everything you've uploaded.</p>
          <button className="btn-primary" onClick={requireLogin}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Your videos</h1>
        <p>Everything you've uploaded — including anything still processing.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p>You haven't uploaded anything yet.</p>
        </div>
      ) : (
        <div className="grid">
          {list.map((v) => (
            <VideoCard key={v.video_id} v={v} />
          ))}
        </div>
      )}
    </main>
  );
}
