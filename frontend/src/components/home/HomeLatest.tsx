import { Link } from "react-router-dom";

import { rabbitHoleTeaser, type RabbitHole } from "../../api";

/**
 * The editorial index directly under the hero: the most recent published
 * RabbitHoles, title and a one-line teaser each, nothing from the reader
 * model. One item gets a "Latest" label and a touch more weight; several
 * grow into a short "Latest RabbitHoles" list. Never a featured-article
 * module, never cards.
 */
export function HomeLatest({ items }: { items: RabbitHole[] }) {
  if (items.length === 0) return null;

  const heading = items.length === 1 ? "Latest" : "Latest RabbitHoles";

  return (
    <section className="home-latest" aria-labelledby="home-latest-h">
      <h2 className="home-latest-h" id="home-latest-h">
        {heading}
      </h2>
      <ul className="home-latest-list">
        {items.map((rh, i) => {
          const teaser = rabbitHoleTeaser(rh);
          return (
            <li
              key={rh.slug}
              className={`home-latest-item${i === 0 ? " is-lead" : ""}`}
            >
              <Link to={`/rabbitholes/${rh.slug}`} className="home-latest-link">
                <h3 className="home-latest-title">{rh.title}</h3>
                {teaser && <p className="home-latest-hook">{teaser}</p>}
                <span className="home-latest-action" aria-hidden="true">
                  Read RabbitHole{" "}
                  <span className="home-latest-arrow">&rarr;</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
