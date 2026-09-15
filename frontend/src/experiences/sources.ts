import type { RabbitHole, RhCitation } from "../api";
import type { SourceRef } from "./types";

/** The public RabbitHole payload exposes a source's stable id only inside
 *  the citations that already reference it (RhCitation.source_id) -- the
 *  plain `sources[]` list itself only carries the display `number`. This
 *  scans every citation already on the article (facts, contested items,
 *  timeline, media) to build a `source_id -> display number` index, so an
 *  experience file can reference the RabbitHole's own stable ids without
 *  a second bibliography and without depending on numbers that can shift
 *  on republish. */
export function buildSourceIdIndex(rh: RabbitHole): Map<string, number> {
  const index = new Map<string, number>();
  const scan = (citations: RhCitation[] | undefined) => {
    citations?.forEach((c) => index.set(c.source_id, c.number));
  };

  rh.what_we_know.forEach((f) => scan(f.citations));
  rh.contested_open?.items.forEach((it) => scan(it.citations));
  rh.timeline?.forEach((t) => scan(t.citations));
  rh.media.forEach((m) => {
    if (m.source) index.set(m.source.source_id, m.source.number);
  });

  return index;
}

/** Resolves a list of experience SourceRefs into the exact RhCitation
 *  shape the article's own <Cites> component already renders -- same
 *  jump-to-source behaviour, same numbering, no separate citation UI. A
 *  ref that doesn't resolve (a genuinely malformed experience file, or a
 *  source that's moved) is silently dropped rather than breaking the
 *  page -- the citation just doesn't render. */
export function resolveSourceRefs(
  refs: SourceRef[] | undefined,
  index: Map<string, number>,
): RhCitation[] {
  if (!refs || refs.length === 0) return [];
  const out: RhCitation[] = [];
  for (const ref of refs) {
    const number = index.get(ref.sourceId);
    if (number !== undefined) out.push({ source_id: ref.sourceId, number });
  }
  return out;
}
