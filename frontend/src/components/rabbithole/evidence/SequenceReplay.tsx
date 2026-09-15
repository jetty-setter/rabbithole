import { useEffect, useState } from "react";

import type { Sequence } from "../../../experiences/types";

const STEP_MS = 1100;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Renders a `kind: "replay"` Sequence: play/pause/scrub/select through
 *  its steps. Knows nothing about what the steps mean -- only that they
 *  have an order, an optional numeric `value` (drives a bar), and a
 *  `meaning` to read out once selected. Which step is selected is this
 *  component's own state (not lifted -- nothing outside a single replay
 *  needs to know which sample is showing); `onSelectEvidence` is the one
 *  hook out to the experience's shared state, used only when a step
 *  points at a specific piece of evidence. Generic across any RabbitHole
 *  that supplies a replay sequence. */
export function SequenceReplay({
  sequence,
  onSelectEvidence,
}: {
  sequence: Sequence;
  onSelectEvidence?: (evidenceId: string) => void;
}) {
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, steps.length]);

  const selectIndex = (i: number) => {
    setPlaying(false);
    setActiveIndex(i);
  };

  const togglePlay = () => {
    setPlaying((p) => {
      if (!p && activeIndex >= steps.length - 1) setActiveIndex(0);
      return !p;
    });
  };

  const max = Math.max(...steps.map((s) => s.value ?? 0), 1);
  const current = steps[activeIndex];
  const elapsed = current?.elapsedSeconds ?? 0;

  return (
    <div className="rh-seq-replay">
      <div className="rh-signal-controls">
        <button
          type="button"
          className="rh-signal-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause the replay" : `Play the ${sequence.totalSeconds ?? ""}-second replay`}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          className="rh-signal-scrub"
          min={0}
          max={steps.length - 1}
          step={1}
          value={activeIndex}
          onChange={(e) => selectIndex(Number(e.target.value))}
          aria-label={`Scrub through the ${steps.length} samples`}
          aria-valuetext={`Sample ${activeIndex + 1} of ${steps.length}: ${current?.label}, elapsed ${formatElapsed(elapsed)}`}
        />
        {sequence.totalSeconds !== undefined && (
          <span className="rh-signal-elapsed" aria-hidden="true">
            {formatElapsed(elapsed)} / {formatElapsed(sequence.totalSeconds)}
          </span>
        )}
      </div>

      <div className="rh-signal-row" role="group" aria-label={sequence.title}>
        {steps.map((step, i) => (
          <button
            type="button"
            key={step.id}
            className={`rh-signal-char${i === activeIndex ? " is-selected" : ""}`}
            onClick={() => selectIndex(i)}
            aria-pressed={i === activeIndex}
            aria-label={`Sample ${i + 1}: ${step.label}${step.valueLabel ? `, ${step.valueLabel}` : ""}${
              step.elapsedSeconds !== undefined ? `, elapsed ${formatElapsed(step.elapsedSeconds)}` : ""
            }`}
          >
            <span className="rh-signal-bar-track" aria-hidden="true">
              <span
                className="rh-signal-bar"
                style={{ height: `${((step.value ?? 0) / max) * 100}%` }}
              />
            </span>
            <span className="rh-signal-glyph" aria-hidden="true">
              {step.label}
            </span>
            {step.valueLabel && (
              <span className="rh-signal-intensity" aria-hidden="true">
                {step.valueLabel}
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div className="rh-signal-readout" aria-live="polite">
          {current.elapsedSeconds !== undefined && (
            <span className="rh-signal-readout-time">{formatElapsed(current.elapsedSeconds)}</span>
          )}
          <span className="rh-signal-readout-char" aria-hidden="true">
            {current.label}
          </span>
          <span className="rh-signal-readout-text">
            {current.valueLabel && <strong>{current.valueLabel} background. </strong>}
            {current.meaning}
            {current.evidenceId && onSelectEvidence && (
              <button
                type="button"
                className="rh-seq-evidence-link"
                onClick={() => onSelectEvidence(current.evidenceId!)}
              >
                See the evidence →
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
