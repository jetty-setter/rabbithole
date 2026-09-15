import { useEffect, useRef, useState } from "react";

import type { SignalSpecimenSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

const STEP_MS = 1100;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "What actually happened during those 72 seconds?" -- answered by doing,
 *  not reading: press play to step through the six samples automatically,
 *  drag the scrubber, or tap any sample directly. The selection persists,
 *  drives the bar chart, and updates a plain-language readout (elapsed
 *  time, intensity, what that reading means). First engagement notifies
 *  the parent so it can highlight the real 6EQUJ5 sequence in the
 *  archival printout. Generic in shape; only the Wow! Signal supplies
 *  data for it today. */
export function SignalReplay({
  spec,
  onEngage,
}: {
  spec: SignalSpecimenSpec;
  onEngage?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const engagedRef = useRef(false);
  const lastCount = spec.characters.length - 1;

  const engage = () => {
    if (!engagedRef.current) {
      engagedRef.current = true;
      onEngage?.();
    }
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= lastCount) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, lastCount]);

  const togglePlay = () => {
    engage();
    setPlaying((p) => {
      if (!p && index >= lastCount) setIndex(0);
      return !p;
    });
  };

  const selectIndex = (i: number) => {
    engage();
    setPlaying(false);
    setIndex(i);
  };

  const max = Math.max(...spec.characters.map((c) => c.value));
  const current = spec.characters[index];
  const elapsed = index * spec.sampleSeconds;

  return (
    <section className="rh-block rh-signal" aria-labelledby="rh-h-signal">
      <SectionHeading id="rh-h-signal">The signal</SectionHeading>

      <div className="rh-signal-controls">
        <button
          type="button"
          className="rh-signal-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause the replay" : "Play the 72-second replay"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          className="rh-signal-scrub"
          min={0}
          max={lastCount}
          step={1}
          value={index}
          onChange={(e) => selectIndex(Number(e.target.value))}
          aria-label="Scrub through the six samples"
          aria-valuetext={`Sample ${index + 1} of ${spec.characters.length}: ${current.char}, elapsed ${formatElapsed(elapsed)}`}
        />
        <span className="rh-signal-elapsed" aria-hidden="true">
          {formatElapsed(elapsed)} / {formatElapsed(spec.totalSeconds)}
        </span>
      </div>

      <div className="rh-signal-row" role="group" aria-label="The six samples">
        {spec.characters.map((c, i) => (
          <button
            type="button"
            key={i}
            className={`rh-signal-char${i === index ? " is-selected" : ""}`}
            onClick={() => selectIndex(i)}
            aria-pressed={i === index}
            aria-label={`Sample ${i + 1}: ${c.char}, ${c.intensityLabel} background, elapsed ${formatElapsed(i * spec.sampleSeconds)}`}
          >
            <span className="rh-signal-bar-track" aria-hidden="true">
              <span
                className="rh-signal-bar"
                style={{ height: `${(c.value / max) * 100}%` }}
              />
            </span>
            <span className="rh-signal-glyph" aria-hidden="true">
              {c.char}
            </span>
            <span className="rh-signal-intensity" aria-hidden="true">
              {c.intensityLabel}
            </span>
          </button>
        ))}
      </div>

      <div className="rh-signal-readout" aria-live="polite">
        <span className="rh-signal-readout-time">{formatElapsed(elapsed)}</span>
        <span className="rh-signal-readout-char" aria-hidden="true">
          {current.char}
        </span>
        <span className="rh-signal-readout-text">
          <strong>{current.intensityLabel} background.</strong> {current.meaning}
        </span>
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
