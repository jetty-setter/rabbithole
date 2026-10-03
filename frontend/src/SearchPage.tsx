import { useMemo, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "./App";
import { EditorialCard } from "./EditorialCard";
import { searchVideos } from "./discovery";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const { videos, loading, catalogError, refresh } = useApp();
  const results = useMemo(() => searchVideos(videos, query), [videos, query]);
  useDocumentMeta(query ? `Search: ${query}` : "Find your next rabbit hole");
  function submit(event: FormEvent) {
    event.preventDefault();
    const draft = String(new FormData(event.currentTarget as HTMLFormElement).get("q") ?? "");
    setParams(draft.trim() ? { q: draft.trim() } : {});
  }
  return <main className="page discovery-search">
    <div className="feed-head"><h1>{query ? `Results for “${query}”` : "What are you curious about?"}</h1>
      <p>Search videos by title, topic, creator, or what makes them worth watching.</p>
    </div>
    <form className="discovery-search-form" role="search" onSubmit={submit}>
      <input key={query} name="q" type="search" aria-label="Search videos" defaultValue={query} placeholder="Deep sea, strange sounds, clockwork…" maxLength={120} />
      <button className="btn-primary" type="submit">Search</button>
    </form>
    {catalogError && <p role="alert">The video catalog could not be loaded. <button className="btn-ghost" onClick={refresh}>Try again</button></p>}
    <p role="status">{loading ? "Loading videos…" : `${results.length} video${results.length === 1 ? "" : "s"}${query ? " found" : " to explore"}.`}</p>
    {!loading && !catalogError && results.length === 0 && <div className="empty"><p>{query ? "No matches yet. Try a broader topic or another word." : "The first finds are on their way."}</p><Link to="/tunnels">Explore topics</Link></div>}
    <div className="home-grid">{results.map((video) => <EditorialCard key={video.video_id} v={video} />)}</div>
  </main>;
}
