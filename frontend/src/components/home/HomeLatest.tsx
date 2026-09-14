import { HomeFeatured } from "./HomeFeatured";
import { HomeIndexRow, type IndexItem } from "./HomeIndexRow";

/**
 * The homepage's Latest section: one eyebrow, the lead feature at full
 * editorial scale, and — once more RabbitHoles are published — a tighter,
 * denser magazine index underneath it. `items` defaults to empty: today
 * there is exactly one thing to feature (see HomeFeatured), so nothing
 * renders here and the page ends cleanly after the lead. When real
 * published RabbitHoles beyond the lead exist, pass them in and they
 * render as compact horizontal image-left/text-right stories in a two-
 * column grid — a curated discovery index, not a repeat of the full lead
 * treatment or a set of alternating mini spreads.
 */
export function HomeLatest({ items = [] }: { items?: IndexItem[] }) {
  return (
    <section className="home-latest" aria-label="Latest">
      <p className="home-latest-eyebrow">Latest</p>
      <HomeFeatured />
      {items.length > 0 && (
        <>
          <p className="home-more-eyebrow">More RabbitHoles</p>
          <ul className="home-latest-index">
            {items.map((item) => (
              <li key={item.slug} className="home-latest-index-item">
                <HomeIndexRow item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
