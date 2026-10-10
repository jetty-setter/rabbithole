import { Link } from "react-router-dom";

/**
 * A published RabbitHole beyond the lead feature, deliberately smaller and
 * quieter than <HomeFeatured>: one lead story, then a denser index. Every row
 * uses the same compact image-left/text-right layout in a two-column grid
 * (see .home-latest-index in home.css).
 *
 * Pass `imageUrl` only for a real, rights-cleared image. Without one the row
 * is text-only, with no placeholder. Pass `imageAlt` with a real image so it
 * is exposed as content, not decoration.
 */
export interface IndexItem {
  slug: string;
  title: string;
  hook: string;
  metadata?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export function HomeIndexRow({ item }: { item: IndexItem }) {
  const hasImage = Boolean(item.imageUrl);
  return (
    <article className={`home-index-row${hasImage ? " has-image" : ""}`}>
      {hasImage && (
        <div
          className="home-index-image"
          aria-hidden={item.imageAlt ? undefined : "true"}
        >
          <img src={item.imageUrl} alt={item.imageAlt ?? ""} loading="lazy" />
        </div>
      )}
      <div className="home-index-text">
        {item.metadata && <p className="home-index-meta">{item.metadata}</p>}
        <h3 className="home-index-title">{item.title}</h3>
        <p className="home-index-hook">{item.hook}</p>
        <Link to={`/rabbitholes/${item.slug}`} className="home-index-action">
          Read RabbitHole
        </Link>
      </div>
    </article>
  );
}
