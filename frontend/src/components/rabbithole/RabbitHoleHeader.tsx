import { monthYear, type RabbitHole } from "../../api";
import { RabbitHoleMedia, type MediaHighlight } from "./RabbitHoleMedia";

/** Title area + trust metadata + Hook + (optional real imagery) -- the
 *  feature opening. Designed to be (most of) the first viewport: you enter
 *  this RabbitHole before you're invited anywhere else. The short version
 *  and any page-specific evidence modules render after this, back in the
 *  article's normal flow (see RabbitHolePage) -- this component only owns
 *  the one deliberately asymmetric composition. When a real image is
 *  present, wide desktop breaks the opening into a two-column composition
 *  (text left, image right) via CSS grid areas -- the DOM order (hook, then
 *  media) is unchanged, only the visual placement shifts. Without media it
 *  simply stacks as a single editorial column, still at the article's full
 *  title scale. */
export function RabbitHoleHeader({
  rh,
  mediaHighlight,
}: {
  rh: RabbitHole;
  mediaHighlight?: MediaHighlight;
}) {
  const published = monthYear(rh.published_at);
  const updated = monthYear(rh.updated_at);
  const dateLabel =
    updated && published && updated !== published
      ? `Updated ${updated}`
      : published
        ? `Published ${published}`
        : "";
  const hasMedia = rh.media.some((m) => m.kind === "image" && m.url);

  return (
    <header className={`rh-head${hasMedia ? " rh-head--media" : ""}`}>
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

      <RabbitHoleMedia items={rh.media} highlight={mediaHighlight} />
    </header>
  );
}
