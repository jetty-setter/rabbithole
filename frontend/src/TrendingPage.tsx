import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";

export function TrendingPage() {
  const { videos } = useApp();

  const list = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url)
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    [videos],
  );

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Trending</h1>
        <p>The most-watched videos right now.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p>Nothing trending yet.</p>
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
