/** Shimmer placeholders shown while data loads — so the page feels alive
 *  instead of flashing empty text. Pure presentational, no props needed. */

function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk sk-thumb" />
      <div className="sk-row">
        <div className="sk sk-avatar" />
        <div className="sk-lines">
          <div className="sk sk-line" style={{ width: "85%" }} />
          <div className="sk sk-line" style={{ width: "55%" }} />
          <div className="sk sk-line short" style={{ width: "40%" }} />
        </div>
      </div>
    </div>
  );
}

/** Editorial hero + grid skeleton for the feed. */
export function SkeletonFeed() {
  return (
    <main className="page" aria-hidden="true">
      <div className="sk-featured">
        <div className="sk sk-featured-thumb" />
        <div className="sk-featured-info">
          <div className="sk sk-line tall" style={{ width: "90%" }} />
          <div className="sk sk-line tall" style={{ width: "60%" }} />
          <div className="sk sk-line" style={{ width: "100%", marginTop: 14 }} />
          <div className="sk sk-line" style={{ width: "80%" }} />
        </div>
      </div>
      <div className="grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}

/** Player + meta skeleton for the watch page. */
export function SkeletonWatch() {
  return (
    <main className="page watch" aria-hidden="true">
      <div className="watch-grid">
        <div className="watch-main">
          <div className="sk sk-player" />
          <div className="sk-watch-meta">
            <div className="sk sk-line tall" style={{ width: "70%" }} />
            <div className="sk-row" style={{ marginTop: 16 }}>
              <div className="sk sk-avatar" />
              <div className="sk-lines">
                <div className="sk sk-line" style={{ width: "40%" }} />
                <div className="sk sk-line short" style={{ width: "30%" }} />
              </div>
            </div>
          </div>
        </div>
        <aside className="watch-related">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="sk-related" key={i}>
              <div className="sk sk-related-thumb" />
              <div className="sk-lines">
                <div className="sk sk-line" style={{ width: "90%" }} />
                <div className="sk sk-line short" style={{ width: "55%" }} />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
