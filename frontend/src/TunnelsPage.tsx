import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "./App";
import { VideoCard } from "./VideoCard";
import { SkeletonFeed } from "./Skeleton";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
import type { Video } from "./api";

// Rough average brightness (0-255) of a thumbnail, sampled at a tiny size
// via an offscreen canvas -- generic, no per-video/per-tag special-casing.
// If the image can't be read (CORS-tainted canvas, load failure), resolves
// to a neutral mid-value so the caller just falls back to its normal pick
// rather than breaking.
function averageBrightness(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 12;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(128);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        resolve(sum / (data.length / 4));
      } catch {
        resolve(128); // tainted canvas -- treat as unknown, don't block the pick
      }
    };
    img.onerror = () => resolve(0);
    img.src = url;
  });
}

// Default number of tunnels shown before "View all tunnels" -- this must
// NOT scale with the catalog size (see the page-height rule in the Browse
// section below), so it stays a fixed small constant, not a fraction of
// `tags.length`.
const DEFAULT_TUNNEL_COUNT = 14;

function TunnelChip({ tag, count }: { tag: string; count: number }) {
  return (
    <Link to={`/tunnels/${encodeURIComponent(tag)}`} className="tunnel-chip">
      <span className="tunnel-tag">#{tag}</span>
      <span className="tunnel-count">{count}</span>
    </Link>
  );
}

function TunnelFeatureCard({
  tag,
  count,
  thumbnail,
  primary,
}: {
  tag: string;
  count: number;
  thumbnail: string | null;
  primary?: boolean;
}) {
  return (
    <Link
      to={`/tunnels/${encodeURIComponent(tag)}`}
      className={primary ? "tunnel-feat-card tunnel-feat-primary" : "tunnel-feat-card tunnel-feat-secondary"}
    >
      {thumbnail ? <img src={thumbnail} alt="" /> : <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />}
      <div className="tunnel-feat-scrim" />
      <div className="tunnel-feat-info">
        <span className="tunnel-feat-tag">#{tag}</span>
        <span className="tunnel-feat-count">
          {count} video{count === 1 ? "" : "s"}
        </span>
        <span className="tunnel-feat-cta">Explore tunnel →</span>
      </div>
    </Link>
  );
}

/** Browse by topic. Every tag is a "tunnel" you can dig into. `/tunnels` shows
 *  the tag cloud; `/tunnels/:tag` shows that tunnel's videos. */
export function TunnelsPage() {
  const { tag } = useParams();
  const { videos, loading } = useApp();

  const ready = useMemo(
    () => videos.filter((v) => v.status === "ready" && !!v.playback_url),
    [videos],
  );

  // Single source of truth for tunnel data: video count per tag, sorted by
  // count descending then alphabetically. Everything below (featured,
  // default chips, search, the A-Z directory) derives from this list, so a
  // future canonical-tag pass (e.g. folding #space/#spaceflight together)
  // only needs to change this one step, not every view that reads it.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of ready) for (const t of v.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [ready]);

  const [tunnelQuery, setTunnelQuery] = useState("");
  const [browseAll, setBrowseAll] = useState(false);

  const defaultTunnels = useMemo(() => tags.slice(0, DEFAULT_TUNNEL_COUNT), [tags]);

  const searchQuery = tunnelQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    return tags.filter(([t]) => t.toLowerCase().includes(searchQuery));
  }, [tags, searchQuery]);

  // A-Z directory for "View all tunnels" -- grouped by first letter,
  // alphabetical within each group (a directory, not another count-sorted
  // list), only the letters actually present.
  const tunnelsByLetter = useMemo(() => {
    const groups = new Map<string, [string, number][]>();
    for (const entry of [...tags].sort((a, b) => a[0].localeCompare(b[0]))) {
      const letter = /^[a-z]/i.test(entry[0]) ? entry[0][0].toUpperCase() : "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(entry);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tags]);

  // The top 3 tunnels by video count. Each is paired with a representative
  // thumbnail chosen generically (no per-tag special-casing) in priority
  // order: has a poster at all > not already used by an earlier featured
  // card in this pass > most-viewed (falling back to most recent) within
  // that tunnel. A card only repeats another's image if the tunnel
  // genuinely has no other option.
  const top3 = useMemo(() => tags.slice(0, 3), [tags]);

  type FeaturedPick = { tag: string; count: number; thumbnail: string | null };

  const rankedByTag = useMemo(() => {
    const map = new Map<string, Video[]>();
    for (const [t] of top3) {
      map.set(
        t,
        ready
          .filter((v: Video) => (v.tags || []).includes(t))
          .sort(
            (a, b) => (b.views ?? 0) - (a.views ?? 0) || (b.created_at || "").localeCompare(a.created_at || ""),
          ),
      );
    }
    return map;
  }, [top3, ready]);

  // Synchronous dedup-only pick -- renders immediately, no flash of an
  // empty section while brightness is sampled.
  const defaultFeatured = useMemo<FeaturedPick[]>(() => {
    const usedThumbs = new Set<string>();
    return top3.map(([t, n]) => {
      const ranked = rankedByTag.get(t) || [];
      const fresh = ranked.find((v) => v.thumbnail_url && !usedThumbs.has(v.thumbnail_url));
      const rep = fresh || ranked.find((v) => v.thumbnail_url) || ranked[0];
      if (rep?.thumbnail_url) usedThumbs.add(rep.thumbnail_url);
      return { tag: t, count: n, thumbnail: rep?.thumbnail_url || null };
    });
  }, [top3, rankedByTag]);

  const [featuredTunnels, setFeaturedTunnels] = useState<FeaturedPick[]>(defaultFeatured);

  useEffect(() => {
    setFeaturedTunnels(defaultFeatured);
    let live = true;

    // Upgrade pass: among each tunnel's unused-poster candidates, swap in
    // one that isn't noticeably dark, if sampling turns one up. Runs after
    // the synchronous pick above is already on screen.
    async function upgrade() {
      const usedThumbs = new Set<string>();
      const picks: FeaturedPick[] = [];

      for (const [t, n] of top3) {
        const ranked = rankedByTag.get(t) || [];
        const withThumb = ranked.filter((v) => v.thumbnail_url);
        const candidates = [
          ...withThumb.filter((v) => !usedThumbs.has(v.thumbnail_url as string)),
          ...withThumb.filter((v) => usedThumbs.has(v.thumbnail_url as string)),
        ];

        let rep = candidates[0] ?? ranked[0];
        const shortlist = candidates.slice(0, 4);
        if (shortlist.length > 1) {
          const brightness = await Promise.all(
            shortlist.map((v) => averageBrightness(v.thumbnail_url as string)),
          );
          const brightEnoughIdx = brightness.findIndex((b) => b > 26);
          if (brightEnoughIdx >= 0) rep = shortlist[brightEnoughIdx];
        }

        if (rep?.thumbnail_url) usedThumbs.add(rep.thumbnail_url);
        picks.push({ tag: t, count: n, thumbnail: rep?.thumbnail_url || null });
      }

      if (live) setFeaturedTunnels(picks);
    }

    if (top3.length > 0) upgrade();

    return () => {
      live = false;
    };
  }, [top3, rankedByTag, defaultFeatured]);

  useDocumentMeta(
    tag ? `#${tag} tunnel` : "Tunnels",
    tag ? `Every video tagged #${tag} on RabbitHole.` : "Dig by topic — every tag is a tunnel.",
  );

  if (loading && ready.length === 0) return <SkeletonFeed />;

  if (tag) {
    const list = ready.filter((v) => (v.tags || []).includes(tag));
    return (
      <main className="page standard-page">
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
    <main className="page standard-page">
      <div className="feed-head">
        <h1>Tunnels</h1>
        <p>Dig by topic — every tag is a tunnel.</p>
      </div>
      {tags.length === 0 ? (
        <div className="empty">
          <p>No tunnels yet — they appear as videos pick up tags.</p>
        </div>
      ) : (
        <>
          <div className="section-head">
            <h2>Start somewhere</h2>
          </div>
          <div className="tunnel-featured">
            {featuredTunnels[0] && <TunnelFeatureCard {...featuredTunnels[0]} primary />}
            {featuredTunnels.length > 1 && (
              <div className="tunnel-feat-secondaries">
                {featuredTunnels.slice(1).map((f) => (
                  <TunnelFeatureCard key={f.tag} {...f} />
                ))}
              </div>
            )}
          </div>

          <div className="section-head">
            <h2>Browse tunnels</h2>
          </div>
          <div className="tunnel-browse-tools">
            <input
              type="text"
              className="tunnel-search-input"
              placeholder="Find a tunnel…"
              value={tunnelQuery}
              onChange={(e) => setTunnelQuery(e.target.value)}
              aria-label="Find a tunnel"
            />
          </div>

          {searchResults ? (
            searchResults.length === 0 ? (
              <p className="muted tunnel-empty-note">No tunnels found.</p>
            ) : (
              <div className="tunnel-cloud tunnels-index-cloud">
                {searchResults.map(([t, n]) => (
                  <TunnelChip key={t} tag={t} count={n} />
                ))}
              </div>
            )
          ) : browseAll ? (
            <>
              <div className="tunnel-directory">
                {tunnelsByLetter.map(([letter, entries]) => (
                  <div className="tunnel-directory-group" key={letter}>
                    <h3 className="tunnel-directory-letter">{letter}</h3>
                    <div className="tunnel-cloud tunnels-index-cloud">
                      {entries.map(([t, n]) => (
                        <TunnelChip key={t} tag={t} count={n} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="link-btn tunnel-view-toggle" onClick={() => setBrowseAll(false)}>
                Show less
              </button>
            </>
          ) : (
            <>
              <div className="tunnel-cloud tunnels-index-cloud">
                {defaultTunnels.map(([t, n]) => (
                  <TunnelChip key={t} tag={t} count={n} />
                ))}
              </div>
              {tags.length > DEFAULT_TUNNEL_COUNT && (
                <button type="button" className="link-btn tunnel-view-toggle" onClick={() => setBrowseAll(true)}>
                  View all tunnels →
                </button>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
