import { Link } from "react-router-dom";

import { type RabbitHoleListItem } from "../../api";

/**
 * An editorial contents list of published RabbitHoles — title and one line,
 * nothing else. The reader page holds the rest of the model. Rendered only
 * when the caller has two or more to show; a single-item list reads as a
 * mistake, so the homepage hides it entirely in that case.
 */
export function HomeDiscovery({ items }: { items: RabbitHoleListItem[] }) {
  return (
    <section className="home-discovery" aria-label="RabbitHoles worth a look">
      <h2 className="home-discovery-h">Worth a look</h2>
      <ul className="home-discovery-list">
        {items.map((rh) => (
          <li key={rh.slug} className="home-discovery-item">
            <Link
              to={`/rabbitholes/${rh.slug}`}
              className="home-discovery-link"
            >
              <span className="home-discovery-title">{rh.title}</span>
              {rh.subtitle && (
                <span className="home-discovery-desc">{rh.subtitle}</span>
              )}
              {rh.source_count > 0 && (
                <span className="home-discovery-meta">
                  {rh.source_count} {rh.source_count === 1 ? "source" : "sources"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
