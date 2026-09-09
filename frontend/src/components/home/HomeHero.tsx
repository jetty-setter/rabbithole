import { Link } from "react-router-dom";

/**
 * Homepage hero. The approved 1980s-basement photograph is a full-bleed
 * cinematic backdrop (a CSS `background-image`, primed by a
 * `<link rel="preload" fetchpriority="high">` in index.html so it still loads
 * as the LCP element). Copy sits in the dark negative space on the left; the
 * rabbit + CRT stay dominant on the right. A restrained left-to-transparent
 * scrim is the only readability treatment and it fades out before the rabbit.
 */
export function HomeHero({ startHref }: { startHref: string }) {
  return (
    <section className="home-hero-grid" aria-label="RabbitHole">
      <div className="home-hero-media" role="img" aria-label="A rabbit sits alone in a dark wood-panelled room, watching an interrupted broadcast on an old television.">
        <div className="home-hero-scrim" aria-hidden="true" />
      </div>

      <div className="home-hero">
        <p className="home-hero-eyebrow">Curiosity, with sources</p>
        <h1 className="home-h1">
          <span className="home-h1-line">Follow the</span>
          <span className="home-h1-line">
            interesting thing<span className="home-hero-dot">.</span>
          </span>
        </h1>
        <p className="home-hero-sub">
          Short, well-sourced RabbitHoles about the things that get more
          interesting the closer you look &mdash; and where they lead.
        </p>
        <div className="home-hero-cta">
          <Link to={startHref} className="home-hero-btn">
            Start somewhere
            <span className="home-hero-btn-arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
