import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";

/** Browse by topic. Every tag is a "tunnel" you can dig into. `/tunnels` shows
 *  the tag cloud; `/tunnels/:tag` shows that tunnel's videos. */
export function TunnelsPage() {
  const { tag } = useParams();
  const { videos } = useApp();

  const ready = useMemo(
    () => videos.filter((v) => v.status === "ready" && !!v.playback_url),
    [videos],
  );

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of ready) for (const t of v.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [ready]);

  if (tag) {
    const list = ready.filter((v) => (v.tags || []).includes(tag));
    return (
      <main className="page">
        <div className="feed-head">
          <h1>#{tag}</h1>
          <p>
            <Link to="/tunnels" className="link-btn">
              ← all tunnels
            </Link>{" "}
            · {list.length} video{list.length === 1 ? "" : "s"}
          </p>
        </div>
        {list.length === 0 ? (
          <div className="empty">
            <p>This tunnel's a dead end.</p>
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

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Tunnels</h1>
        <p>Dig by topic — every tag is a tunnel.</p>
      </div>
      {tags.length === 0 ? (
        <div className="empty">
          <p>No tunnels yet — they appear as videos pick up tags.</p>
        </div>
      ) : (
        <div className="tunnel-cloud">
          {tags.map(([t, n]) => (
            <Link key={t} to={`/tunnels/${encodeURIComponent(t)}`} className="tunnel-chip">
              <span className="tunnel-tag">#{t}</span>
              <span className="tunnel-count">{n}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
