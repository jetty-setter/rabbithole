import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { pickFeatured } from "./api";
import { EditorialCard } from "./EditorialCard";
import { FeaturedCard } from "./FeaturedCard";
import { SkeletonFeed } from "./Skeleton";
import { MapIcon } from "./Icons";

// Real curiosities, not tags — each returns a strong transcript-search result
// against the current catalogue and points at a different corner of it
// (animal behaviour · spaceflight · social history).
const SEARCH_EXAMPLES = [
  "how animals survive winter",
  "apollo 11 moon landing",
  "the history of immigration",
];

export function LibraryPage() {
  const { videos, loading, authed, username, setHeroSearchVisible } = useApp();
  const navigate = useNavigate();
  const [homeQuery, setHomeQuery] = useState("");
  const heroSearchRef = useRef<HTMLFormElement>(null);

  function runSearch(term: string) {
    const t = term.trim();
    if (t) navigate(`/search?q=${encodeURIComponent(t)}`);
  }

  function submitHomeSearch(e: FormEvent) {
    e.preventDefault();
    runSearch(homeQuery);
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

  // Tell the nav to hold its Search trigger while the hero's own search is on
  // screen, and hand it back once the hero scrolls away (or the page
  // unmounts). IntersectionObserver is the mechanism; a plain scroll/resize
  // handler reading the element's real geometry (no magic pixel numbers) is a
  // fallback for environments where IO doesn't deliver. `setHeroSearchVisible`
  // no-ops when the value is unchanged, so the scroll handler is cheap.
  useEffect(() => {
    if (!featured) return;
    const el = heroSearchRef.current;

    const update = () => {
      const r = el?.getBoundingClientRect();
      setHeroSearchVisible(!!r && r.bottom > 0 && r.top < window.innerHeight);
    };
    update();

    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => setHeroSearchVisible(entry.isIntersecting),
        { threshold: 0 },
      );
      io.observe(el);
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      setHeroSearchVisible(false);
    };
  }, [featured, setHeroSearchVisible]);

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
                <p className="home-hero-eyebrow">Search beneath the surface</p>
                <h1 className="home-h1">
                  <span className="home-h1-line">Go deeper.</span>
                  <span className="home-h1-line">Follow</span>
                  <span className="home-h1-line">
                    Curiosity<span className="home-hero-dot">.</span>
                  </span>
                </h1>
                <p className="home-hero-sub">
                  Search what was actually said. Jump to the exact moment. Follow
                  the idea wherever it leads.
                </p>
                <form className="home-search-form" ref={heroSearchRef} onSubmit={submitHomeSearch}>
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
                <p className="home-search-eg">
                  <span className="home-search-eg-label">Try:</span>{" "}
                  {SEARCH_EXAMPLES.map((ex, i) => (
                    <Fragment key={ex}>
                      {i > 0 && (
                        <span className="home-search-eg-sep" aria-hidden="true"> · </span>
                      )}
                      <button
                        type="button"
                        className="home-search-eg-item"
                        onClick={() => runSearch(ex)}
                      >
                        {ex}
                      </button>
                    </Fragment>
                  ))}
                </p>
              </div>
              {/* Phone-only: a real, portrait-cropped hero plate that sits
                  below the text rather than the wide desktop plate scaled
                  small behind it. Hidden (and never fetched) on desktop,
                  where .home-hero-grid's own background is the hero. */}
              <div className="home-hero-art" aria-hidden="true" />
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
