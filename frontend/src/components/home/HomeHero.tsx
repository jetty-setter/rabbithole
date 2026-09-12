import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Homepage hero. The approved 1980s-basement photograph is a full-bleed
 * cinematic backdrop (a CSS `background-image`, primed by a
 * `<link rel="preload" fetchpriority="high">` in index.html so it still loads
 * as the LCP element). Copy sits in the dark negative space on the left; the
 * rabbit + CRT stay dominant on the right. A restrained left-to-transparent
 * scrim is the only readability treatment and it fades out before the rabbit.
 *
 * The call to action is a real search: one composed control — a charcoal
 * field with a text-only DIVE IN submit inside its right end — that posts
 * into the existing `/search?q=` route (same navigation the old nav Search
 * used). Enter or DIVE IN submits; an empty query never does.
 */
export function HomeHero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
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
