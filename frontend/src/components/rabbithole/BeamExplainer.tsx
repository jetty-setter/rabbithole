import { useRef, useState } from "react";

import type { BeamExplainerSpec } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

type Stage = "idle" | "first" | "gap" | "second";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** "Why is the missing second detection important?" -- a direct, replayable
 *  comparison rather than a diagram to decode. The end state (both passes
 *  fully shown) is the default, so the page reads without interaction;
 *  Replay re-runs the staged reveal -- the source crosses the first feed
 *  (a real signal profile appears), the expected gap is named, then the
 *  second feed's flat line resolves to "nothing detected". The absence is
 *  the payoff, read from the shape alone -- no connecting line or node
 *  between the two panels. Generic in shape; only the Wow! Signal
 *  supplies data for it today. */
export function BeamExplainer({ spec }: { spec: BeamExplainerSpec }) {
  // Default state is fully revealed -- the conclusion is never hidden
  // behind an interaction.
  const [stage, setStage] = useState<Stage>("second");
  const timers = useRef<number[]>([]);

  const replay = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const reduced = prefersReducedMotion();
    const delays: [number, number, number] = reduced ? [0, 0, 0] : [100, 950, 1850];
    setStage("idle");
    timers.current = [
      window.setTimeout(() => setStage("first"), delays[0]),
      window.setTimeout(() => setStage("gap"), delays[1]),
      window.setTimeout(() => setStage("second"), delays[2]),
    ];
  };

  const [first, second] = spec.passes;
  const firstShown = stage !== "idle";
  const gapShown = stage === "gap" || stage === "second";
  const secondShown = stage === "second";

  return (
    <section className="rh-block rh-beam" aria-labelledby="rh-h-beam">
      <SectionHeading id="rh-h-beam">{spec.title}</SectionHeading>
      <p className="rh-beam-desc">{spec.description}</p>

      <button type="button" className="rh-beam-replay" onClick={replay}>
        <span aria-hidden="true">▶</span> Replay
      </button>

      <div className="rh-pass-grid" aria-live="polite">
        <div className="rh-pass rh-pass--hit">
          <span className="rh-pass-label">{first.label}</span>
          <svg
            className="rh-pass-profile"
            style={{ opacity: firstShown ? 1 : 0 }}
            viewBox="0 0 200 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,62 C48,62 62,8 100,8 C138,8 152,62 200,62"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <span className="rh-pass-state" style={{ opacity: firstShown ? 1 : 0 }}>
            {first.state}
          </span>
        </div>

        <div className="rh-pass rh-pass--miss">
          <span className="rh-pass-label">{second.label}</span>
          {second.timing && (
            <span className="rh-pass-timing" style={{ opacity: gapShown ? 1 : 0 }}>
              {second.timing}
            </span>
          )}
          <svg
            className="rh-pass-profile"
            style={{ opacity: secondShown ? 1 : 0 }}
            viewBox="0 0 200 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
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
          </svg>
          <span className="rh-pass-state" style={{ opacity: secondShown ? 1 : 0 }}>
            {second.state}
          </span>
        </div>
      </div>

      <p className="rh-beam-conclusion">{spec.conclusion}</p>
    </section>
  );
}
