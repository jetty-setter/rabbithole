import type { RhMedia } from "../../api";
import type { HighlightRegion } from "../../rabbitholeExtras";
import { Cites } from "./CitationLink";

export interface MediaHighlight {
  region: HighlightRegion;
  active: boolean;
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
 *  `highlight`, when supplied, draws a quiet box over a real region of the
 *  image (measured against its actual pixels, in percentages so it holds
 *  up at any rendered size) and only shows it once `active` -- letting a
 *  page-specific interaction (see SignalReplay) point back at the real
 *  evidence without ever modifying the image itself. */
export function RabbitHoleMedia({
  items,
  highlight,
}: {
  items: RhMedia[];
  highlight?: MediaHighlight;
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
            {highlight && (
              <span
                className={`rh-media-highlight${highlight.active ? " is-active" : ""}`}
                style={{
                  left: `${highlight.region.left}%`,
                  top: `${highlight.region.top}%`,
                  width: `${highlight.region.width}%`,
                  height: `${highlight.region.height}%`,
                }}
                aria-hidden="true"
              />
            )}
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
