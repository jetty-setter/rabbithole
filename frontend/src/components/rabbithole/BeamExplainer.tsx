import { Fragment } from "react";

import type { BeamExplainerSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

/** A simple, intuitive explainer for "this should have repeated, but didn't"
 *  -- a sequence of expected passes rendered as plain labelled points on a
 *  line, one missing. Generic in shape (any RabbitHole explaining a missed
 *  expected recurrence could reuse it); not a technical instrument
 *  schematic. */
export function BeamExplainer({ spec }: { spec: BeamExplainerSpec }) {
  return (
    <section className="rh-block rh-beam" aria-labelledby="rh-h-beam">
      <SectionHeading id="rh-h-beam">{spec.title}</SectionHeading>
      <p className="rh-beam-desc">{spec.description}</p>
      <div className="rh-beam-diagram">
        {spec.passes.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="rh-beam-connector" aria-hidden="true">
                <span className="rh-beam-line" />
                <span className="rh-beam-gap">{spec.gapLabel}</span>
              </span>
            )}
            <div className={`rh-beam-pass${p.detected ? "" : " is-missing"}`}>
              <span className="rh-beam-dot" aria-hidden="true" />
              <span className="rh-beam-label">{p.label}</span>
              <span className="rh-beam-note">{p.note}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
