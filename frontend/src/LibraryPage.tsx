import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";
import { displayTitle } from "./api";

export function LibraryPage() {
  const { videos, authed, query } = useApp();

  const ready = useMemo(
    () => videos.filter((v) => v.status === "ready" && !!v.playback_url),
    [videos],
  );

  const list = useMemo(
    () => ready.filter((v) => displayTitle(v).toLowerCase().includes(query.toLowerCase())),
    [ready, query],
  );

  return (
    <main className="page">
      {ready.length === 0 ? (
        <div className="empty">
          <img src="/RHLogo.png?v=5" alt="RabbitHole" className="empty-logo" />
          <h3>Nothing in the hole yet</h3>
          <p>{authed ? "Throw the first one down." : "The rabbit's still digging — check back soon."}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>The rabbit came up empty{query ? ` for “${query}”` : ""}.</p>
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
