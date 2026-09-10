import { Link } from "react-router-dom";

import { rabbitHoleTeaser, type RabbitHole } from "../../api";

/**
 * The editorial index directly under the hero: the most recent published
 * RabbitHoles, title and a one-line teaser each, nothing from the reader
 * model. Never cards, never a featured-article module.
 *
 * Exactly one published RabbitHole gets a wide two-column feature — a
 * dominant title on the left, the hook and read action on the right, like
 * a magazine opener. Two or more collapse into a short single-column
 * editorial list. The markup is shared; only the section modifier and the
 * lead label differ, so adding RabbitHoles later just changes which
 * branch renders.
 */
export function HomeLatest({ items }: { items: RabbitHole[] }) {
  if (items.length === 0) return null;

  const solo = items.length === 1;
  const heading = solo ? "Latest" : "Latest RabbitHoles";

  return (
    <section
      className={`home-latest${solo ? " home-latest--solo" : ""}`}
      aria-labelledby="home-latest-h"
    >
      <h2 className="home-latest-h" id="home-latest-h">
        {heading}
      </h2>
      <ul className="home-latest-list">
        {items.map((rh, i) => {
          const teaser = rabbitHoleTeaser(rh);
          return (
            <li
              key={rh.slug}
              className={`home-latest-item${!solo && i === 0 ? " is-lead" : ""}`}
            >
              <Link to={`/rabbitholes/${rh.slug}`} className="home-latest-link">
                <h3 className="home-latest-title">{rh.title}</h3>
                <div className="home-latest-text">
                  {teaser && <p className="home-latest-hook">{teaser}</p>}
                  <span className="home-latest-action" aria-hidden="true">
                    Read RabbitHole{" "}
                    <span className="home-latest-arrow">&rarr;</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
