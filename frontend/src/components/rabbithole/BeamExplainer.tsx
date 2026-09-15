import type { BeamExplainerSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

/** A direct visual comparison, not a diagram to decode: a detected pass
 *  beside a missing one, each with its own signal profile -- a real curve
 *  for the hit, a flat line for the miss. The absence should read at a
 *  glance from the shape alone, no connecting line or node between them.
 *  Generic in shape (any RabbitHole explaining a missed expected
 *  recurrence could reuse it); not an instrument schematic. */
export function BeamExplainer({ spec }: { spec: BeamExplainerSpec }) {
  return (
    <section className="rh-block rh-beam" aria-labelledby="rh-h-beam">
      <SectionHeading id="rh-h-beam">{spec.title}</SectionHeading>
      <p className="rh-beam-desc">{spec.description}</p>
      <div className="rh-pass-grid">
        {spec.passes.map((p, i) => (
          <div className={`rh-pass${p.detected ? " rh-pass--hit" : " rh-pass--miss"}`} key={i}>
            <span className="rh-pass-label">{p.label}</span>
            {p.timing && <span className="rh-pass-timing">{p.timing}</span>}
            <svg
              className="rh-pass-profile"
              viewBox="0 0 200 70"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {p.detected ? (
                <path
                  d="M0,62 C48,62 62,8 100,8 C138,8 152,62 200,62"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              ) : (
                <line
                  x1="0"
                  y1="62"
                  x2="200"
                  y2="62"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="2 10"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <span className="rh-pass-state">{p.state}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
