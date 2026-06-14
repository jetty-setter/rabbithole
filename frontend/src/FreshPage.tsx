import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";

/** Newest drops, strictly chronological — the "what's new" feed (vs Surfacing,
 *  which ranks by views). */
export function FreshPage() {
  const { videos } = useApp();

  const list = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [videos],
  );

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
        <div className="grid">
          {list.map((v) => (
            <VideoCard key={v.video_id} v={v} />
          ))}
        </div>
      )}
    </main>
  );
}
