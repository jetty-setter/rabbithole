import { useMemo } from "react";
import { useApp } from "./App";
import { EditorialCard } from "./EditorialCard";
import { SkeletonFeed } from "./Skeleton";

/** Newest drops, strictly chronological — the "what's new" feed (vs Trending,
 *  which ranks by views). */
export function FreshPage() {
  const { videos, loading } = useApp();

  const list = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [videos],
  );

  if (loading && list.length === 0) return <SkeletonFeed />;

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Fresh</h1>
        <p>The latest down the hole — newest first.</p>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p>Nothing fresh yet.</p>
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
