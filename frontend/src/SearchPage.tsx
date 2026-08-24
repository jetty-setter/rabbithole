import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { displayTitle, searchMoments, type SearchMoment } from "./api";
import { Avatar } from "./Avatar";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Semantic search results — the best moment per matching video, each a deep
 *  link that jumps the player to that timestamp. */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [results, setResults] = useState<SearchMoment[] | null>([]);

  const trailStats = useMemo(() => {
    if (!results || results.length < 2) return null;
    const videoIds = new Set(results.map((r) => r.video.video_id));
    const creators = new Set(results.map((r) => r.video.owner || "RabbitHole"));
    return { moments: results.length, videos: videoIds.size, creators: creators.size };
  }, [results]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setResults(null); // loading
    let live = true;
    searchMoments(q).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, [q]);

  return (
    <main className="page">
      <div className="feed-head">
        <h1>Search</h1>
        <p>
          {q
            ? `Moments matching “${q}” — semantic, across every transcript.`
            : "Search what was actually said. RabbitHole reads every video's transcript and jumps you straight to the matching moment — not just titles and tags."}
        </p>
      </div>

      {results === null ? (
        <p className="muted transcript-note">
          <span className="proc-spinner sm" /> Searching the library…
        </p>
      ) : results.length === 0 ? (
        <div className="empty">
          <p>
            {q
              ? `No spoken moments matched “${q}”.`
              : "Try a phrase someone might have actually said on camera — search runs across every video's transcript, by meaning, not just keywords."}
          </p>
        </div>
      ) : (
        <>
          {trailStats && (
            <div className="trail-banner">
              <span className="trail-banner-label">Trail</span>
              <span className="trail-banner-stats">
                {trailStats.moments} moments · {trailStats.videos} videos ·{" "}
                {trailStats.creators} {trailStats.creators === 1 ? "creator" : "creators"}
              </span>
            </div>
          )}
          <div className="search-results">
          {results.map((r) => (
            <Link
              key={r.video.video_id}
              to={`/watch/${r.video.video_id}?t=${Math.floor(r.start)}`}
              className="search-hit"
            >
              <div className="search-thumb">
                {r.video.thumbnail_url ? (
                  <img src={r.video.thumbnail_url} alt="" />
                ) : (
                  <span className="thumb-ph">🐇</span>
                )}
                <span className="dur-badge">{fmt(r.start)}</span>
              </div>
              <div className="search-info">
                <h3 className="search-title">{displayTitle(r.video)}</h3>
                <p className="search-snippet">“…{r.snippet}…”</p>
                <div className="search-by">
                  <Avatar name={r.video.owner || "RabbitHole"} />
                  <span>
                    {r.video.owner || "RabbitHole"} · jump to {fmt(r.start)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </>
      )}
    </main>
  );
}
