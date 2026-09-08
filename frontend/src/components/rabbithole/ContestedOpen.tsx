import type { RhContestedOpen } from "../../api";
import { Cites } from "./CitationLink";
import { Limitation, SectionHeading, StateChip } from "./parts";

/** Optional. Reads differently from "What we know" on purpose: this is where
 *  a myth gets corrected and a live disagreement gets laid out. Epistemic in
 *  tone, never alarming. */
export function ContestedOpen({ data }: { data: RhContestedOpen }) {
  return (
    <section className="rh-block rh-contested" aria-labelledby="rh-h-contested">
      <SectionHeading id="rh-h-contested">What&rsquo;s contested or still open</SectionHeading>
      <div className="rh-contested-body">
        {data.intro && <p className="rh-contested-intro">{data.intro}</p>}

        <ol className="rh-contested-list">
          {data.items.map((it, i) => (
            <li className="rh-contested-item" key={i}>
              <div className="rh-contested-claim-row">
                <StateChip state={it.state} />
                <p className="rh-contested-claim">{it.claim}</p>
              </div>
              <p className="rh-contested-text">
                {it.body} <Cites citations={it.citations} />
              </p>
              {it.why && <Limitation text={it.why} />}
            </li>
          ))}
        </ol>

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
      </div>
    </section>
  );
}
