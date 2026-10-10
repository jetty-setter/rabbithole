import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "./App";
import { EditorialCard } from "./EditorialCard";
import { searchVideos } from "./discovery";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
import { canSeekExactMoment, canTranscriptSearch, displayTitle, searchMoments, type SearchMoment, type Video } from "./api";
import { publicVideos } from "./discovery";
import { useTranscriptPrefill } from "./hooks/useTranscriptPrefill";
import { HighlightedText } from "./components/HighlightedText";
import { splitTranscriptMatches } from "./transcriptMatches";

function PassageList({ hits, query }: { hits: SearchMoment[]; query: string }) {
  return <>{hits.map(hit => {
    const timed = canSeekExactMoment(hit.video);
    const seconds = Math.max(0, Math.floor(hit.start));
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const url = `/watch/${hit.video.video_id}${timed ? `?t=${seconds}` : ""}`;
    return <article className="transcript-result" key={hit.video.video_id}>
      <h3><Link to={url}><HighlightedText text={displayTitle(hit.video)} query={query} />{timed ? ` · ${time}` : ""}</Link></h3>
      <p><HighlightedText text={hit.snippet} query={query} /></p>
      <Link className="link-btn" to={url}>{timed ? `Watch from ${time}` : "Watch video"}</Link>
    </article>;
  })}</>;
}

function SearchInput({ videos, query }: { videos: Video[]; query: string }) {
  const [draft, setDraft] = useTranscriptPrefill(videos, query);
  return <input name="q" type="search" aria-label="Search videos" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Deep sea, strange sounds, clockwork…" maxLength={120} />;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const { videos, loading, catalogError, refresh } = useApp();
  const results = useMemo(() => searchVideos(videos, query), [videos, query]);
  const searchableCount = publicVideos(videos).filter(canTranscriptSearch).length;
  const [retry, setRetry] = useState(0);
  const [moments, setMoments] = useState<{ query: string; results: SearchMoment[]; status: "loading" | "ready" | "failed" }>({ query: "", results: [], status: "ready" });
  const { matches, related } = splitTranscriptMatches(moments.results, query);
  useEffect(() => {
    if (!query || !searchableCount) return;
    let live = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    setMoments({ query, results: [], status: "loading" });
    searchMoments(query, controller.signal).then(found => {
      if (live) setMoments({ query, results: found, status: "ready" });
    }).catch(() => {
      if (live) setMoments({ query, results: [], status: "failed" });
    }).finally(() => window.clearTimeout(timeout));
    return () => { live = false; controller.abort(); window.clearTimeout(timeout); };
  }, [query, searchableCount, retry]);
  useDocumentMeta(query ? `Search: ${query}` : "Find your next rabbit hole");
  function submit(event: FormEvent) {
    event.preventDefault();
    const draft = String(new FormData(event.currentTarget as HTMLFormElement).get("q") ?? "");
    setParams(draft.trim() ? { q: draft.trim() } : {});
  }
  return <main className="page discovery-search">
    <div className="feed-head"><h1>{query ? `Results for “${query}”` : "What are you curious about?"}</h1>
    </div>
    <form className="discovery-search-form" role="search" onSubmit={submit}>
      <SearchInput key={query} videos={videos} query={query} />
      <button className="btn-primary" type="submit">Search</button>
    </form>
    {catalogError && <p role="alert">The video catalog could not be loaded. <button className="btn-ghost" onClick={refresh}>Try again</button></p>}
    <p>{searchableCount} of {publicVideos(videos).length} videos have searchable transcripts.</p>
    {query && searchableCount > 0 && <section className="transcript-results" aria-labelledby="spoken-results">
      <h2 id="spoken-results">Matches in transcripts</h2>
      {(moments.query !== query || moments.status === "loading") ? <p role="status">Searching transcripts…</p> : moments.status === "failed" ? <p role="alert">Transcript search couldn’t finish. <button className="link-btn" onClick={() => setRetry(n => n + 1)}>Try again</button></p> : <>
        {matches.length === 0 && <p>No transcript matches.</p>}
        <PassageList hits={matches} query={query} />
        {related.length > 0 && <details className="related-passages" key={query}>
          <summary><span className="related-passages-label">Related videos <span className="related-passages-count">{related.length}</span></span><span className="related-passages-toggle" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" /></svg></span></summary>
          <div className="related-passages-body"><PassageList hits={related} query={query} /></div>
        </details>}
      </>}
    </section>}
    {query && results.length > 0 && <h2>Video matches</h2>}
    {(loading || results.length > 0) && <p role="status">{loading ? "Loading videos…" : `${results.length} video${results.length === 1 ? "" : "s"}${query ? " found" : " to explore"}.`}</p>}
    {!loading && !catalogError && results.length === 0 && searchableCount === 0 && <div className="empty"><p>{query ? "No matches yet. Try a broader topic or another word." : "The first finds are on their way."}</p><Link to="/tunnels">Explore topics</Link></div>}
    <div className="home-grid">{results.map((video) => <EditorialCard key={video.video_id} v={video} highlightQuery={query} />)}</div>
  </main>;
}
