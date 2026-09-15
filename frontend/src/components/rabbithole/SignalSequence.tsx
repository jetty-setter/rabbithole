import type { SignalSequenceSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

/** A signature evidence module: the raw character sequence behind a signal,
 *  each glyph paired with a bar sized to its relative strength. Generic in
 *  shape (any RabbitHole with a comparable intensity-coded reading could use
 *  it) even though only one article supplies data for it today. Real
 *  typography and a simple bar chart carry it -- no waveform illustration,
 *  no terminal-style chrome. */
export function SignalSequence({ spec }: { spec: SignalSequenceSpec }) {
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
      <p className="rh-signal-caption">
        {spec.caption} Each sample spans about {spec.sampleSeconds} seconds — {spec.totalSeconds}{" "}
        seconds in total.
      </p>
    </section>
  );
}
