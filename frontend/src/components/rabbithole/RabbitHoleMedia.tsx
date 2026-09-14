import type { RhMedia } from "../../api";
import { Cites } from "./CitationLink";

/** A real archival/source image attached to a RabbitHole — generic across
 *  articles (a manuscript crop, an engraving, a photograph), not built for
 *  any one story. Renders only `kind === "image"` items with a resolved
 *  `url`; anything else (a future video/document kind, or a media item the
 *  API couldn't resolve a url for yet) is silently skipped rather than
 *  showing a broken slot. Sits in the same reading column as the rest of
 *  the article — no card, no full-bleed break-out — so it reads as part of
 *  the story rather than a decorative header image. */
export function RabbitHoleMedia({ items }: { items: RhMedia[] }) {
  const images = items.filter((m) => m.kind === "image" && m.url);
  if (images.length === 0) return null;

  return (
    <div className="rh-media-group">
      {images.map((m, i) => (
        <figure className="rh-media" key={i} data-role={m.role}>
          <img
            src={m.url ?? undefined}
            alt={m.caption ?? ""}
            className="rh-media-image"
            loading="lazy"
          />
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
