import { useState } from "react";

import type { RhContestedOpen } from "../../api";
import { Cites } from "./CitationLink";
import { SectionHeading, StateChip } from "./parts";

/** "Which explanation best fits the evidence?" -- answered by comparing,
 *  not scrolling through a wall of prose. Pick a hypothesis; its case, its
 *  problems and its current standing appear in one shared panel, so
 *  switching between hypotheses is a direct comparison. Same data the
 *  generic ContestedOpen reads (RhContestedOpen) -- no invented evidence,
 *  no changed credibility states, the same citations. Generic in shape;
 *  RabbitHolePage only reaches for it on articles with the interactive
 *  treatment (see rabbitholeExtras) -- every other RabbitHole still gets
 *  the plain linear ContestedOpen. */
export function EvidenceExplorer({ data }: { data: RhContestedOpen }) {
  const [active, setActive] = useState(0);
  const item = data.items[active];

  return (
    <section className="rh-block rh-contested" aria-labelledby="rh-h-contested">
      <SectionHeading id="rh-h-contested">What&rsquo;s contested or still open</SectionHeading>
      {data.intro && <p className="rh-contested-intro">{data.intro}</p>}

      {item && (
        <div className="rh-explorer">
          <div className="rh-explorer-tabs" role="group" aria-label="Hypotheses">
            {data.items.map((it, i) => (
              <button
                type="button"
                key={i}
                className={`rh-explorer-tab${i === active ? " is-active" : ""}`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
              >
                {it.claim.replace(/\.$/, "")}
              </button>
            ))}
          </div>

          <div className="rh-explorer-panel" aria-live="polite">
            <div className="rh-explorer-standing">
              <span className="rh-explorer-standing-label">Current standing</span>
              <StateChip state={item.state} />
            </div>

            <div className="rh-explorer-evidence">
              <h3 className="rh-explorer-h">Supports</h3>
              <p className="rh-explorer-text">
                {item.body} <Cites citations={item.citations} />
              </p>
            </div>

            {item.why && (
              <div className="rh-explorer-evidence">
                <h3 className="rh-explorer-h rh-explorer-h--problem">Problems</h3>
                <p className="rh-explorer-text">{item.why}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {data.open_questions.length > 0 && (
        <div className="rh-open-qs">
          <h3 className="rh-open-qs-h">Still open</h3>
          <ul className="rh-open-qs-list">
            {data.open_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
