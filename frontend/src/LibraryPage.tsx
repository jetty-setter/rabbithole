import { useMemo } from "react";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";
import { displayTitle } from "./api";

export function LibraryPage() {
  const { videos, authed, username, query } = useApp();

  // The signed-in user's own in-progress uploads (so they get live feedback).
  const mine = useMemo(
    () => (authed ? videos.filter((v) => v.owner === username && v.status !== "ready") : []),
    [videos, authed, username],
  );

  const ready = useMemo(
    () => videos.filter((v) => v.status === "ready" && !!v.playback_url),
    [videos],
  );

  const list = useMemo(
    () =>
      [...mine, ...ready].filter((v) =>
        displayTitle(v).toLowerCase().includes(query.toLowerCase()),
      ),
    [mine, ready, query],
  );

  const hasAny = mine.length + ready.length > 0;

  return (
    <main className="page">
      {!hasAny ? (
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
