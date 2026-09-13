import { Link } from "react-router-dom";

/**
 * A published RabbitHole beyond the lead feature. Deliberately smaller and
 * quieter than <HomeFeatured> — a publication front page has one lead
 * story and a tighter index under it, not a repeated stack of identical
 * templates. Imagery is optional: only supply `imageUrl` where a real,
 * rights-cleared image exists. Without one the row is text-only rather
 * than forcing a placeholder graphic.
 */
export interface IndexItem {
  slug: string;
  title: string;
  hook: string;
  metadata?: string;
  imageUrl?: string;
}

export function HomeIndexRow({
  item,
  imageSide,
}: {
  item: IndexItem;
  imageSide: "left" | "right";
}) {
  const hasImage = Boolean(item.imageUrl);
  return (
    <article
      className={`home-index-row${hasImage ? ` has-image image-${imageSide}` : ""}`}
    >
      <div className="home-index-text">
        <h3 className="home-index-title">{item.title}</h3>
        {item.metadata && <p className="home-index-meta">{item.metadata}</p>}
        <p className="home-index-hook">{item.hook}</p>
        <Link to={`/rabbitholes/${item.slug}`} className="home-index-action">
          Read RabbitHole
        </Link>
      </div>
      {hasImage && (
        <div className="home-index-image" aria-hidden="true">
          <img src={item.imageUrl} alt="" loading="lazy" />
        </div>
      )}
    </article>
  );
}
