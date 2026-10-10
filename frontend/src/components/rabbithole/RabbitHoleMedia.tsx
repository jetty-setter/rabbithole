import type { RhMedia } from "../../api";
import { Cites } from "./CitationLink";

export interface MediaHotspot {
  id: string;
  region: { left: number; top: number; width: number; height: number };
  label: string;
  explain: string;
}

/** An archival/source image attached to a RabbitHole, generic across articles.
 *  Renders only `kind === "image"` items that have a resolved `url`. Anything
 *  else is skipped instead of showing a broken slot. It sits in the article's
 *  reading column, not as a card or a full-bleed header.
 *
 *  `hotspots` draws clickable regions over the image, as percentages so they
 *  hold at any size. The component only knows a region's label, explanation
 *  and id, which it reports through `onActivateHotspot`. The image itself is
 *  never modified. */
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
