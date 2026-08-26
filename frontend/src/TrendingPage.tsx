import { useMemo } from "react";
import { useApp } from "./App";
import { EditorialCard } from "./EditorialCard";
import { SkeletonFeed } from "./Skeleton";

export function TrendingPage() {
  const { videos, loading } = useApp();

  const list = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url)
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    [videos],
  );

  if (loading && list.length === 0) return <SkeletonFeed />;

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Trending</h1>
        <p>What's clawing its way up the hole right now.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p>Nothing's surfaced yet.</p>
        </div>
      ) : (
        <div className="home-grid">
          {list.map((v) => (
            <EditorialCard key={v.video_id} v={v} />
          ))}
        </div>
      )}
    </main>
  );
}
