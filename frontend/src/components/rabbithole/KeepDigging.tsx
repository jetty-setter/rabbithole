import { Link } from "react-router-dom";

import type { RhConnection } from "../../api";
import { SectionHeading } from "./parts";

/** "Here is where this idea leads" — not "related articles". The one-sentence
 *  reason is the point; the internal relationship type is never shown. A
 *  destination that isn't published yet renders as a real, styled node marked
 *  "coming soon" — never a dead link. */
export function KeepDigging({ connections }: { connections: RhConnection[] }) {
  const sorted = [...connections].sort((a, b) => a.order - b.order);

  return (
    <section className="rh-block rh-keep" aria-labelledby="rh-h-keep">
      <SectionHeading id="rh-h-keep">Keep digging</SectionHeading>
      <ul className="rh-keep-list">
        {sorted.map((c, i) => {
          const soon = !c.destination;
          const title = c.destination?.title ?? c.coming_soon?.title ?? "";
          const inner = (
            <>
              <span className="rh-keep-title">
                {title}
                {soon && <span className="rh-keep-soon">coming soon</span>}
              </span>
              <p className="rh-keep-why">{c.why_care}</p>
            </>
          );
          return (
            <li className={`rh-keep-item${soon ? " is-soon" : ""}`} key={i}>
              <span className="rh-keep-node" aria-hidden="true" />
              {soon ? (
                <div className="rh-keep-inner" aria-disabled="true">
                  {inner}
                </div>
              ) : (
                <Link
                  className="rh-keep-inner"
                  to={`/rabbitholes/${c.destination!.slug}`}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
