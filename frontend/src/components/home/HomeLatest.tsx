import { HomeFeatured } from "./HomeFeatured";
import { HomeIndexRow, type IndexItem } from "./HomeIndexRow";

/**
 * The homepage's Latest section: one eyebrow, the lead feature at full
 * editorial scale, and — once more RabbitHoles are published — a tighter,
 * denser magazine index alongside/underneath it. `items` defaults to
 * empty: today there is exactly one thing to feature (see HomeFeatured),
 * so nothing renders here and the page ends cleanly after the lead. When
 * real published RabbitHoles beyond the lead exist, pass them in and they
 * render as compact horizontal image-left/text-right stories — a curated
 * discovery index, not a repeat of the full lead treatment or a set of
 * alternating mini spreads.
 *
 * .home-latest-lead-zone and .home-latest-rail-zone are plain wrappers at
 * every width below wide desktop (the lead feature and the index simply
 * stack, same as before this pair of divs existed) -- they only become
 * two side-by-side editorial zones via .home-latest-shell.has-rail's own
 * grid at >=1500px (see home.css). The `has-rail` modifier is only
 * present when there's actually a rail to lay out beside the lead --
 * without it the shell never engages the two-zone grid, so the empty-
 * items state (no rail at all) renders exactly as before.
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
