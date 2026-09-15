import type { SignalSpecimenSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

/** One major editorial moment, not a widget: the raw six-character reading
 *  at real scale, its total duration, and the handful of facts that belong
 *  beside it -- a scientific specimen / observation record, not a KPI
 *  dashboard. Generic in shape (any RabbitHole with a comparable
 *  intensity-coded reading could supply its own spec) even though only one
 *  article uses it today. Real typography, a bar chart and open space
 *  carry it -- no boxes, no terminal chrome. */
export function SignalSpecimen({ spec }: { spec: SignalSpecimenSpec }) {
  const max = Math.max(...spec.characters.map((c) => c.value));

  return (
    <section className="rh-block rh-signal" aria-labelledby="rh-h-signal">
      <SectionHeading id="rh-h-signal">The signal</SectionHeading>

      <div className="rh-signal-row">
        {spec.characters.map((c, i) => (
          <div className="rh-signal-char" key={i}>
            <span className="rh-signal-bar-track" aria-hidden="true">
              <span
                className="rh-signal-bar"
                style={{ height: `${(c.value / max) * 100}%` }}
              />
            </span>
            <span className="rh-signal-glyph">{c.char}</span>
            <span className="rh-signal-intensity">{c.intensityLabel}</span>
          </div>
        ))}
      </div>

      <div className="rh-signal-duration">
        <span className="rh-signal-duration-value">{spec.totalSeconds}</span>
        <span className="rh-signal-duration-label">
          seconds total
          <br />
          six {spec.sampleSeconds}-second samples
        </span>
      </div>

      <div className="rh-signal-record">
        {spec.primaryFacts.map((f, i) => (
          <div className="rh-signal-fact" key={i}>
            <span className="rh-signal-fact-value">{f.value}</span>
            <span className="rh-signal-fact-label">{f.label}</span>
          </div>
        ))}
      </div>

      <p className="rh-signal-note">{spec.note}</p>
    </section>
  );
}
