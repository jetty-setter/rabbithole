import { monthYear, type RabbitHole } from "../../api";

/** Title area + trust metadata + Hook + The Short Version.
 *  Designed to be (most of) the first viewport: you enter this RabbitHole
 *  before you're invited anywhere else. */
export function RabbitHoleHeader({ rh }: { rh: RabbitHole }) {
  const published = monthYear(rh.published_at);
  const updated = monthYear(rh.updated_at);
  const dateLabel =
    updated && published && updated !== published
      ? `Updated ${updated}`
      : published
        ? `Published ${published}`
        : "";

  return (
    <header className="rh-head">
      <p className="rh-eyebrow">RabbitHole</p>

      <h1 className="rh-title">{rh.title}</h1>
      {rh.subtitle && <p className="rh-subtitle">{rh.subtitle}</p>}

      <p className="rh-meta">
        <a href="#rh-h-sources" className="rh-meta-sources">
          {rh.sources.length} {rh.sources.length === 1 ? "source" : "sources"}
        </a>
        {dateLabel && (
          <span className="rh-meta-part">
            <span className="rh-meta-dot" aria-hidden="true">·</span>
            {dateLabel}
          </span>
        )}
        {rh.author_display && (
          <span className="rh-meta-part">
            <span className="rh-meta-dot" aria-hidden="true">·</span>
            {rh.author_display}
          </span>
        )}
      </p>

      {rh.hook && (
        <div className="rh-hook">
          <p>{rh.hook}</p>
        </div>
      )}

      {rh.short_version && (
        <section className="rh-short" aria-labelledby="rh-h-short">
          <h2 className="rh-short-label" id="rh-h-short">
            The short version
          </h2>
          <p className="rh-short-text">{rh.short_version}</p>
        </section>
      )}
    </header>
  );
}
