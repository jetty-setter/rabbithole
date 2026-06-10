import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";

export function FavoritesPage() {
  const { videos, favorites, authed, requireLogin } = useApp();

  const list = useMemo(
    () => videos.filter((v) => favorites.has(v.video_id) && v.status === "ready" && !!v.playback_url),
    [videos, favorites],
  );

  if (!authed) {
    return (
      <main className="page">
        <div className="empty">
          <h3>Your Burrow</h3>
          <p>Sign in to stash videos and dig them up later.</p>
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
        <h1>Your Burrow</h1>
        <p>Everything you've stashed away.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <span className="empty-heart">🐇</span>
          <h3>Your burrow's empty</h3>
          <p>Tap the heart on any video to stash it here.</p>
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
