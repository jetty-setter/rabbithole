import { useMemo } from "react";
import { useApp } from "./App";
import { EditorialCard } from "./EditorialCard";

/** Local watch history — the trail of videos you've been down, newest first. */
export function TrailPage() {
  const { videos, trail, clearTrail } = useApp();

  const list = useMemo(() => {
    const byId = new Map(videos.map((v) => [v.video_id, v]));
    return trail
      .map((id) => byId.get(id))
      .filter((v): v is NonNullable<typeof v> => !!v && v.status === "ready" && !!v.playback_url);
  }, [videos, trail]);

  return (
    <main className="page">
      <div className="feed-head trail-head">
        <div>
          <h1>Trail</h1>
          <p>Where you've been — most recent first.</p>
        </div>
        {list.length > 0 && (
          <button className="btn-ghost" onClick={clearTrail}>
            Clear trail
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <img src="/rabbit-hole-logo.png" alt="" className="empty-mark" />
          <h3>No trail yet</h3>
          <p>Watch a few videos and they'll show up here.</p>
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
