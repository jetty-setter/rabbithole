import { useEffect, useState } from "react";
import { getEvidence, type EvidenceResult } from "../../api";
import "../../styles/evidence-search.css";

export function EvidenceSearch({ slug }: { slug: string }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<EvidenceResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const term = query.trim();
  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    let polls = 0;
    setData(null);
    setError(false);
    setLoading(true);
    const load = async () => {
      try {
        const result = await getEvidence(slug, term.length >= 2 ? term : undefined, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
        if (result.status === "processing" && polls++ < 24) timer = window.setTimeout(load, 5000);
      } catch {
        if (!controller.signal.aborted) { setError(true); setLoading(false); }
      }
    };
    timer = window.setTimeout(load, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [slug, term, retry]);
  const ready = data?.jobs.filter((j) => j.status === "ready").length ?? 0;
  return <section className="rh-block rh-evidence" aria-labelledby="rh-h-evidence">
    <h2 className="rh-section-h" id="rh-h-evidence">Search the evidence</h2>
    <p>Find words in the article’s source material. Extracted passages provide context; they do not verify a claim.</p>
    <label className="rh-evidence-search">Words to find
      <input type="search" value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} placeholder="Search source passages" />
    </label>
    <p role="status" aria-live="polite">
      {error ? "Evidence search is temporarily unavailable." : loading ? "Loading evidence…" :
        `${ready} of ${data?.jobs.length ?? 0} sources searchable.${data?.status === "processing" ? " More sources are processing." : ""}`}
    </p>
    {error && <button onClick={() => setRetry((n) => n + 1)}>Try again</button>}
    {data && <details><summary>Source processing details</summary><ul>
      {data.jobs.map((j) => <li key={j.source_id}>
        <a href={`#rh-source-${j.number}`}>[{j.number}] {j.title}</a> — {j.status}
        {j.detail && <span> · {j.detail}</span>}
        {j.truncated && <span> · Only the first part of this source is indexed.</span>}
      </li>)}
    </ul></details>}
    {term.length === 1 && <p>Enter at least two characters.</p>}
    {data && term.length >= 2 && <>
      <p>{data.total_matches === 0 ? "No matching passages in the indexed sources." : `${data.total_matches} matching passages${data.total_matches > 50 ? " (showing the first 50)" : ""}.`}</p>
      <ol className="rh-evidence-results">{data.matches.map((m) => <li key={`${m.source_id}-${m.passage_index}`}>
        <a href={`#rh-source-${m.number}`}>[{m.number}] {m.title}</a><blockquote>{m.passage}</blockquote>
      </li>)}</ol>
    </>}
  </section>;
}
