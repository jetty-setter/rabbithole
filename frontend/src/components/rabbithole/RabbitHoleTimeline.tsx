import type { RhTimelineEntry } from "../../api";
import { Cites } from "./CitationLink";
import { SectionHeading } from "./parts";

/** Optional. A tight two-column chronology — date, then event — with a hairline
 *  between rows. No component-library timeline, no big circles, no card per
 *  date. Stacks the date above the event on the narrowest screens. */
export function RabbitHoleTimeline({ entries }: { entries: RhTimelineEntry[] }) {
  return (
    <section className="rh-block rh-timeline" aria-labelledby="rh-h-timeline">
      <SectionHeading id="rh-h-timeline">Timeline</SectionHeading>
      <ol className="rh-tl">
        {entries.map((e, i) => (
          <li className="rh-tl-row" key={i}>
            <span className="rh-tl-date">{e.label}</span>
            <span className="rh-tl-event">
              {e.text} <Cites citations={e.citations} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
