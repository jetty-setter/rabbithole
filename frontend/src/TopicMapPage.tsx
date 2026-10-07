import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "./App";
import { buildMysteryCases } from "./mysteryCases";
import { SkeletonFeed } from "./Skeleton";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function TopicMapPage() {
  const { videos, loading } = useApp();
  const cases = useMemo(() => buildMysteryCases(videos), [videos]);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const path = params.getAll("case").filter(id => cases.some(c => c.id === id)).slice(-30);
  const current = cases.find(c => c.id === path[path.length - 1]);
  const follow = (id: string) => {
    const prior = path.indexOf(id);
    setParams({ case: prior >= 0 ? path.slice(0, prior + 1) : [...path, id].slice(-30) });
  };
  useDocumentMeta("Map", "Follow the connections between strange cases, one mystery at a time.");
  const starts = ["mothman", "wow-signal", "max-headroom", "cicada-3301", "db-cooper", "will-o-the-wisp"];
  const matches = query.trim()
    ? cases.filter(c => `${c.title} ${c.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    : showAll ? cases : starts.flatMap(id => cases.filter(c => c.id === id));
  if (loading && !cases.length) return <SkeletonFeed />;
  return <main className="page standard-page case-map">
    <header className="feed-head"><h1>Map</h1><p>One mystery leads to another. Choose where to go next.</p></header>
    {!cases.length ? <p>No cases available yet.</p> : !current ? <>
      <label className="case-search">Find a case<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Mothman, signals, or disappearances" /></label>
      <h2>{query.trim() ? "Matching cases" : "Choose your starting point"}</h2>
      <div className="case-starts">{matches.map(c => <button className="case-start" key={c.id} onClick={() => follow(c.id)}>
        <img src={c.videos[0].thumbnail_url || "/RHRabbit.png?v=5"} alt="" /><span><strong>{c.title}</strong><small>{c.connections.length} connections · Explore</small></span>
      </button>)}</div>
      {!matches.length && <p>No matching cases. Try another name or topic.</p>}
      {!query.trim() && <button className="link-btn case-all" onClick={() => setShowAll(!showAll)}>{showAll ? "Show starting points" : `Browse all ${cases.length} cases`}</button>}
    </> : <>
      <nav className="case-route" aria-label="Your route"><button onClick={() => setParams({})}>Starting points</button>{path.map((id, index) => <span key={`${id}-${index}`}><span aria-hidden="true"> / </span><button aria-current={index === path.length - 1 ? "step" : undefined} onClick={() => setParams({ case: path.slice(0, index + 1) })}>{cases.find(c => c.id === id)?.title}</button></span>)}</nav>
      <section className="case-current" aria-labelledby="current-case">
        <Link to={`/watch/${current.videos[0].video_id}`} aria-label={`Watch ${current.title}`}><img src={current.videos[0].thumbnail_url || "/RHRabbit.png?v=5"} alt="" /></Link>
        <div><span className="case-eyebrow">You are here</span><h2 id="current-case">{current.title}</h2><p>{current.description}</p><div className="case-watch-links">{current.videos.map((video, index) => <Link className="btn-primary" key={video.video_id} to={`/watch/${video.video_id}`}>{current.videos.length > 1 ? `Watch perspective ${index + 1}` : "Watch video"}</Link>)}</div></div>
      </section>
      <section aria-labelledby="case-branches"><h2 id="case-branches">Where does this lead?</h2><p className="case-note">Pick one to dig into next.</p>
        <div className="case-branches">{current.connections.slice(0, 4).map(edge => {
          const next = cases.find(c => c.id === edge.target)!;
          return <article className="case-branch" key={next.id}><Link to={`/watch/${next.videos[0].video_id}`} aria-label={`Watch ${next.title}`}><img src={next.videos[0].thumbnail_url || "/RHRabbit.png?v=5"} alt="" /></Link><div><h3>{next.title}</h3><p>{edge.reason}</p><button className="btn-primary" onClick={() => follow(next.id)}>Dig deeper</button></div></article>;
        })}</div>
        {!current.connections.length && <p>This branch ends here for now. Choose an earlier stop to explore another case.</p>}
      </section>
    </>}
  </main>;
}
