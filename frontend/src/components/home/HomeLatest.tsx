import { HomeFeatured } from "./HomeFeatured";
import { HomeIndexRow, type IndexItem } from "./HomeIndexRow";

/**
 * The homepage's Latest section: the lead feature at full scale, plus a
 * compact magazine index of further RabbitHoles when `items` is non-empty
 * (it defaults to empty, so the page ends after the lead).
 *
 * Below 1500px the lead and the index stack. At wide desktop,
 * `.home-latest-shell.has-rail` lays them out as two side-by-side zones (see
 * home.css). `has-rail` is set only when there is a rail to show, so the
 * empty state renders as before.
 */
export function HomeLatest({ items = [] }: { items?: IndexItem[] }) {
  const hasMore = items.length > 0;
  return (
    <section className="home-latest" aria-label="Latest">
      <div className={`home-latest-shell${hasMore ? " has-rail" : ""}`}>
        <div className="home-latest-lead-zone">
          <p className="home-latest-eyebrow">Latest</p>
          <HomeFeatured />
        </div>
        {hasMore && (
          <div className="home-latest-rail-zone">
            <p className="home-more-eyebrow">More RabbitHoles</p>
            <ul className="home-latest-index">
              {items.map((item) => (
                <li key={item.slug} className="home-latest-index-item">
                  <HomeIndexRow item={item} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
