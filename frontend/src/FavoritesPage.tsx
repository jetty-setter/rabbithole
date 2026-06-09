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
          <h3>Your favorites</h3>
          <p>Sign in to save videos and revisit them here.</p>
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
        <h1>Favorites</h1>
        <p>Videos you've saved.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <span className="empty-heart">♥</span>
          <h3>No favorites yet</h3>
          <p>Tap the heart on any video to save it here.</p>
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
