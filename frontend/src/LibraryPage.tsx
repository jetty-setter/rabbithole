import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { pickFeatured } from "./api";
import { EditorialCard } from "./EditorialCard";
import { FeaturedCard } from "./FeaturedCard";
import { SkeletonFeed } from "./Skeleton";
import { MapIcon } from "./Icons";

export function LibraryPage() {
  const { videos, loading, authed, username } = useApp();
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

  const list = useMemo(() => [...mine, ...ready], [mine, ready]);

  const hasAny = mine.length + ready.length > 0;

  // An admin-curated video wins the Featured slot; otherwise the newest ready
  // video, so the homepage never breaks if nothing is curated yet.
  const featured = pickFeatured(ready);
  const gridList = featured ? list.filter((v) => v.video_id !== featured.video_id) : list;
  // Curated, not a full catalog dump: three clean rows of four, predictable
  // page length, no awkward partial final row. The rest lives at /fresh.
  const homeGridList = gridList.slice(0, 12);

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
    <main className="page home-page">
      {!hasAny ? (
        <div className="empty">
          <img src="/rabbit-hole-logo.png" alt="RabbitHole" className="empty-logo" />
          <h3>Nothing in the hole yet</h3>
          <p>{authed ? "Throw the first one down." : "The rabbit's still digging — check back soon."}</p>
        </div>
      ) : (
        <>
          {featured && (
            <div className="home-hero-grid">
              <div className="home-hero">
                <h1 className="home-h1">
                  <span className="home-h1-line">Go deeper.</span>
                  <span className="home-h1-line">Follow</span>
                  <span className="home-h1-line">
                    Curiosity<span className="home-hero-dot">.</span>
                  </span>
                </h1>
                <p className="home-hero-sub">
                  Search across every <em>spoken</em> moment — RabbitHole reads every video's
                  transcript and jumps you straight to it, not just titles and tags.
                </p>
                <form className="home-search-form" onSubmit={submitHomeSearch}>
                  <svg className="home-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  <input
                    className="home-search-input"
                    placeholder="What are you curious about?"
                    value={homeQuery}
                    onChange={(e) => setHomeQuery(e.target.value)}
                  />
                  <button type="submit" className="home-search-btn" aria-label="Search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </button>
                </form>
              </div>
            </div>
          )}
          {featured && (
            <div className="home-browse">
              <div className="home-browse-inner">
                <div className="section-head">
                  <h2>
                    Start somewhere<span className="home-punct">.</span>
                  </h2>
                </div>
                {startTopics.length > 0 && (
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
                )}
                <FeaturedCard v={featured} />
                {homeGridList.length > 0 && (
                  <>
                    <div className="section-head section-head-explore">
                      <h2>
                        Explore more<span className="home-punct">.</span>
                      </h2>
                    </div>
                    <div className="home-grid">
                      {homeGridList.map((v) => (
                        <EditorialCard key={v.video_id} v={v} />
                      ))}
                    </div>
                    <Link to="/fresh" className="archive-cta">
                      Browse the archive <span aria-hidden="true">→</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
