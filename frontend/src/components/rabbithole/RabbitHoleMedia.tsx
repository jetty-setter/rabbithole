import type { RhMedia } from "../../api";
import { Cites } from "./CitationLink";

export interface MediaHotspot {
  id: string;
  region: { left: number; top: number; width: number; height: number };
  label: string;
  explain: string;
}

/** A real archival/source image attached to a RabbitHole — generic across
 *  articles (a manuscript crop, an engraving, a photograph), not built for
 *  any one story. Renders only `kind === "image"` items with a resolved
 *  `url`; anything else (a future video/document kind, or a media item the
 *  API couldn't resolve a url for yet) is silently skipped rather than
 *  showing a broken slot. Sits in the same reading column as the rest of
 *  the article — no card, no full-bleed break-out — so it reads as part of
 *  the story rather than a decorative header image.
 *
 *  `hotspots`, when supplied, draws real clickable regions over the image
 *  (measured against its actual pixels, in percentages so they hold up at
 *  any rendered size) -- a generic capability, not tied to any experience
 *  concept: this component only knows a region has a label, an
 *  explanation, and an id to report back through `onActivateHotspot`. The
 *  image itself is never modified. */
export function RabbitHoleMedia({
  items,
  hotspots,
  onActivateHotspot,
}: {
  items: RhMedia[];
  hotspots?: MediaHotspot[];
  onActivateHotspot?: (hotspotId: string) => void;
}) {
  const images = items.filter((m) => m.kind === "image" && m.url);
  if (images.length === 0) return null;

  return (
    <div className="rh-media-group">
      {images.map((m, i) => (
        <figure className="rh-media" key={i} data-role={m.role}>
          <div className="rh-media-frame">
            <img
              src={m.url ?? undefined}
              alt={m.caption ?? ""}
              className="rh-media-image"
              loading="lazy"
            />
            {i === 0 &&
              hotspots?.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  className="rh-media-hotspot"
                  style={{
                    left: `${h.region.left}%`,
                    top: `${h.region.top}%`,
                    width: `${h.region.width}%`,
                    height: `${h.region.height}%`,
                  }}
                  aria-label={`${h.label}: ${h.explain}`}
                  onClick={() => onActivateHotspot?.(h.id)}
                >
                  <span className="rh-media-hotspot-tag" aria-hidden="true">
                    {h.label}
                  </span>
                </button>
              ))}
          </div>
          {(m.caption || m.credit) && (
            <figcaption className="rh-media-caption">
              {m.caption && <span>{m.caption}</span>}
              {m.source && <Cites citations={[m.source]} />}
              {m.credit && <span className="rh-media-credit">{m.credit}</span>}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
