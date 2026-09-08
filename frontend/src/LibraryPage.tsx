import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { canWatch, pickFeatured } from "./api";
import { EditorialCard } from "./EditorialCard";
import { FeaturedCard } from "./FeaturedCard";
import { CuriosityPath } from "./CuriosityPath";
import { SkeletonFeed } from "./Skeleton";

// The hero's three-line product statement: each reads as a plain sentence
// with a subtly emphasised opening word.
const HERO_POINTS: [string, string][] = [
  ["Search", "what was said."],
  ["Jump", "to the exact moment."],
  ["Explore", "what connects."],
];

export function LibraryPage() {
  const { videos, loading, authed, username, setHeroSearchVisible } = useApp();
  const navigate = useNavigate();
  const [homeQuery, setHomeQuery] = useState("");
  const heroSearchRef = useRef<HTMLFormElement>(null);

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
    () => videos.filter(canWatch),
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
                  <span className="home-h1-line">
                    Wonder more<span className="home-hero-dot">.</span>
                  </span>
                </h1>
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
                <ul className="home-hero-points" role="list">
                  {HERO_POINTS.map(([verb, rest]) => (
                    <li className="home-hero-point" key={verb}>
                      <span className="home-hero-point-verb">{verb}</span> {rest}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {featured && (
            <div className="home-browse">
              <div className="home-browse-inner">
                <div className="section-head">
                  <h2>
                    Start with an idea<span className="home-punct">.</span>
                  </h2>
                </div>
                <CuriosityPath videos={ready} />
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
