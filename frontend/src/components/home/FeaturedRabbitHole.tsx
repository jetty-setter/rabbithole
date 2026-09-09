import { Link } from "react-router-dom";

import { monthYear, type RabbitHole } from "../../api";

/** The homepage's entry point: the most recent published RabbitHole, given a
 *  full editorial treatment (not a card). Its own "keep digging" connections
 *  come along, so the homepage shows the graph beginning to form with real
 *  data — coming-soon destinations included, never as dead links. */
export function FeaturedRabbitHole({ rh }: { rh: RabbitHole }) {
  const href = `/rabbitholes/${rh.slug}`;
  const firstLine = rh.hook
    ? rh.hook.split(/(?<=[.?!])\s+/)[0]
    : (rh.short_version ?? "").split(/(?<=[.?!])\s+/)[0];
  const date = monthYear(rh.published_at);
  const next = [...rh.keep_digging].sort((a, b) => a.order - b.order).slice(0, 5);

  return (
    <section className="home-featured" aria-labelledby="home-featured-title">
      <p className="home-featured-eyebrow">Start here</p>

      <Link to={href} className="home-featured-lead">
        <h2 className="home-featured-title" id="home-featured-title">
          {rh.title}
        </h2>
        {rh.subtitle && <p className="home-featured-sub">{rh.subtitle}</p>}
      </Link>

      {firstLine && <p className="home-featured-hook">{firstLine}</p>}

      <p className="home-featured-meta">
        <span>
          {rh.sources.length} {rh.sources.length === 1 ? "source" : "sources"}
        </span>
        {date && (
          <>
            <span className="home-featured-dot" aria-hidden="true">
              &middot;
            </span>
            <span>{date}</span>
          </>
        )}
        <Link to={href} className="home-featured-cta">
          Read it<span aria-hidden="true"> &rarr;</span>
        </Link>
      </p>

      {next.length > 0 && (
        <div className="home-featured-next">
          <p className="home-featured-next-h">Where it goes from here</p>
          <ul className="rh-keep-list">
            {next.map((c, i) => {
              const soon = !c.destination;
              const title = c.destination?.title ?? c.coming_soon?.title ?? "";
              const inner = (
                <>
                  <span className="rh-keep-title">
                    {title}
                    {soon && <span className="rh-keep-soon">coming soon</span>}
                  </span>
                  <p className="rh-keep-why">{c.why_care}</p>
                </>
              );
              return (
                <li className={`rh-keep-item${soon ? " is-soon" : ""}`} key={i}>
                  <span className="rh-keep-node" aria-hidden="true" />
                  {soon ? (
                    <div className="rh-keep-inner" aria-disabled="true">
                      {inner}
                    </div>
                  ) : (
                    <Link
                      className="rh-keep-inner"
                      to={`/rabbitholes/${c.destination!.slug}`}
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
