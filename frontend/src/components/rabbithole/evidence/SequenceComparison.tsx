import { useRef, useState } from "react";

import type { Sequence } from "../../../experiences/types";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Renders a `kind: "comparison"` Sequence: a small number of named
 *  passes, some detected and some not, shown as a real signal-profile
 *  curve beside a flat line -- the absence reads from the shape alone,
 *  no connecting line or node between panels. The end state (every step
 *  fully resolved) is the default, so the conclusion is never hidden
 *  behind an interaction; a Replay button re-runs the staged reveal --
 *  each step's timing surfaces, then its profile and state resolve, in
 *  order -- for whoever wants to watch it happen rather than just read
 *  it. Generic across any RabbitHole that supplies a comparison
 *  sequence. */
export function SequenceComparison({
  sequence,
  onSelectEvidence,
}: {
  sequence: Sequence;
  onSelectEvidence?: (evidenceId: string) => void;
}) {
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  // -1 before any step's timing has surfaced; revealed === steps.length
  // is the resting/default state, where every step is fully shown.
  const [revealed, setRevealed] = useState(steps.length);
  const timers = useRef<number[]>([]);

  const replay = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const reduced = prefersReducedMotion();
    setRevealed(0);
    steps.forEach((_, i) => {
      const delay = reduced ? 0 : 250 + i * 900;
      timers.current.push(window.setTimeout(() => setRevealed(i + 1), delay));
    });
  };

  return (
    <div className="rh-seq-comparison">
      <button type="button" className="rh-beam-replay" onClick={replay}>
        <span aria-hidden="true">▶</span> Replay
      </button>

      <div className="rh-pass-grid" aria-live="polite">
        {steps.map((step, i) => {
          const timingShown = revealed >= i; // surfaces just before this step resolves
          const resolvedShown = revealed > i;
          return (
            <div className={`rh-pass${step.detected ? " rh-pass--hit" : " rh-pass--miss"}`} key={step.id}>
              <span className="rh-pass-label">{step.label}</span>
              {step.timing && (
                <span className="rh-pass-timing" style={{ opacity: timingShown ? 1 : 0 }}>
                  {step.timing}
                </span>
              )}
              <svg
                className="rh-pass-profile"
                style={{ opacity: resolvedShown ? 1 : 0 }}
                viewBox="0 0 200 70"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {step.detected ? (
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
              <span className="rh-pass-state" style={{ opacity: resolvedShown ? 1 : 0 }}>
                {step.state}
              </span>
              {step.evidenceId && onSelectEvidence && (
                <button
                  type="button"
                  className="rh-seq-evidence-link"
                  onClick={() => onSelectEvidence(step.evidenceId!)}
                >
                  See the evidence →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
