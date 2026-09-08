import type { CredibilityState, RhFact } from "../../api";
import { Cites } from "./CitationLink";
import { Limitation, SectionHeading, StateChip } from "./parts";

/** The credibility engine: 4–8 established facts, indexed and scannable.
 *  Established items show no chip; a Contested / Unsupported / Debunked fact
 *  shows its chip and, when present, its limitation line. */
export function WhatWeKnow({ facts }: { facts: RhFact[] }) {
  return (
    <section className="rh-block rh-wwk" aria-labelledby="rh-h-wwk">
      <SectionHeading id="rh-h-wwk">What we know</SectionHeading>
      <ol className="rh-wwk-list">
        {facts.map((f, i) => {
          const chipState: CredibilityState | null =
            f.state && f.state !== "established" ? f.state : null;
          return (
            <li className="rh-wwk-item" key={i}>
              <span className="rh-wwk-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="rh-wwk-body">
                <p className="rh-wwk-text">
                  {f.text} <Cites citations={f.citations} />
                  {chipState && <StateChip state={chipState} />}
                </p>
                {chipState && f.why && <Limitation text={f.why} />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
