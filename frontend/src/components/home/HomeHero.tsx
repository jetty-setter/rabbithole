import { useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Video } from "../../api";
import { useTranscriptPrefill } from "../../hooks/useTranscriptPrefill";

/**
 * Homepage hero: a full-bleed basement photograph as a CSS background
 * (preloaded in index.html so it is still the LCP element), with copy in the
 * dark space on the left and the rabbit and CRT on the right. A
 * left-to-transparent scrim is the only readability treatment.
 *
 * The call to action is a real search: one control with a DIVE IN submit
 * inside it, posting to `/search?q=`. An empty query never submits.
 */
export function HomeHero({ videos = [] }: { videos?: Video[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useTranscriptPrefill(videos);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) {
      inputRef.current?.focus();
      return;
    }
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <section className="home-hero-grid" aria-label="RabbitHole">
      <div className="home-hero-media" role="img" aria-label="A rabbit sits alone in a dark wood-panelled room, watching an interrupted broadcast on an old television.">
        <div className="home-hero-scrim" aria-hidden="true" />
      </div>

      <div className="home-hero">
        <p className="home-hero-eyebrow">Follow curiosity</p>
        <h1 className="home-h1">
          <span className="home-h1-line">See what&rsquo;s</span>
          <span className="home-h1-line">inside</span>
        </h1>
        <p className="home-hero-sub">
          Some things only make sense when you&rsquo;ve gone too far.
        </p>
        <form className="home-hero-search" role="search" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="search"
            className="home-hero-search-input"
            placeholder="Search..."
            aria-label="Search RabbitHole transcripts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="home-hero-search-submit">
            Dive in
          </button>
        </form>
      </div>
    </section>
  );
}
