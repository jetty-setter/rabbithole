import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";
import { FeaturedCard } from "./FeaturedCard";
import { SkeletonFeed } from "./Skeleton";
import { displayTitle } from "./api";
import { MapIcon } from "./Icons";

export function LibraryPage() {
  const { videos, loading, authed, username, query } = useApp();
  const navigate = useNavigate();
  const [homeQuery, setHomeQuery] = useState("");

  function submitHomeSearch(e: FormEvent) {
    e.preventDefault();
    const term = homeQuery.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  }

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

  const featured = !query.trim() && ready.length > 0 ? ready[0] : null;
  const gridList = featured ? list.filter((v) => v.video_id !== featured.video_id) : list;

  // A taste of the ways to follow curiosity here, right under the search
  // hero — otherwise Tunnels, Trail-through-search, and the Map are only
  // discoverable via the sidebar, and a first-time visitor may never find
  // them at all.
  const startTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of ready) for (const t of v.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [ready]);

  if (loading && !hasAny) return <SkeletonFeed />;

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
        <>
          {featured && (
            <div className="home-hero">
              <h1>What are you curious about?</h1>
              <form className="home-search-form" onSubmit={submitHomeSearch}>
                <input
                  className="home-search-input"
                  placeholder="Search what was actually said…"
                  value={homeQuery}
                  onChange={(e) => setHomeQuery(e.target.value)}
                />
                <button type="submit" className="home-search-btn" aria-label="Search">
                  ↵
                </button>
              </form>
              <p className="home-hero-sub">
                RabbitHole reads every video's transcript and jumps you straight to the
                moment — not just titles and tags.
              </p>
              {startTopics.length > 0 && (
                <div className="start-somewhere">
                  <span className="start-label">Or start somewhere</span>
                  <div className="start-row">
                    {startTopics.map(([tag, n]) => (
                      <Link
                        key={tag}
                        to={`/tunnels/${encodeURIComponent(tag)}`}
                        className="tunnel-chip start-chip"
                      >
                        <span className="tunnel-tag">#{tag}</span>
                        <span className="tunnel-count">{n}</span>
                      </Link>
                    ))}
                    <Link to="/map" className="start-map-link">
                      <MapIcon />
                      Explore the topic map
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          {featured && <FeaturedCard v={featured} />}
          {gridList.length > 0 && (
            <div className="grid">
              {gridList.map((v) => (
                <VideoCard key={v.video_id} v={v} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
