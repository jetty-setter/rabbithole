import { monthYear, type RabbitHole } from "../../api";
import { RabbitHoleMedia, type MediaHotspot } from "./RabbitHoleMedia";

/** The feature opening: title, trust metadata, Hook and optional imagery,
 *  designed to fill most of the first viewport. The short version and any
 *  evidence modules render after it in the article's normal flow (see
 *  RabbitHolePage).
 *
 *  With real imagery, wide desktop uses a two-column grid (text left, image
 *  right). DOM order stays hook then media and only placement changes.
 *  Without media it stacks as one editorial column at full title scale. */
export function RabbitHoleHeader({
  rh,
  mediaHotspots,
  onActivateHotspot,
}: {
  rh: RabbitHole;
  mediaHotspots?: MediaHotspot[];
  onActivateHotspot?: (hotspotId: string) => void;
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

      <RabbitHoleMedia items={rh.media} hotspots={mediaHotspots} onActivateHotspot={onActivateHotspot} />
    </header>
  );
}
