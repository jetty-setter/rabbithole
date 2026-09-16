import { buildSmoothPath, playheadAt, valueAtTime, type TimedPoint } from "../interpolate";
import { ease } from "../motion";

const BOX = { width: 900, height: 260 };

export interface SignalStep {
  label: string;
  elapsedSeconds: number;
  value: number;
  valueLabel?: string;
}

/** Sequence 2 -- THE SIGNAL RECONSTRUCTION. One designed signal form (a
 *  luminous, restrained contour -- a filled band under a bright edge, not
 *  an equalizer, not a stock waveform), continuously interpolated from
 *  the six real samples via Catmull-Rom (interpolate.ts, shared with the
 *  reduced-motion sample picker). The real 72 seconds are compressed into
 *  this sequence's own screen duration; `progress` (0..1) maps linearly
 *  onto that original 72s domain so the curve math and the glyph
 *  positions stay in the samples' real, authored proportions. A vertical
 *  beam sweeps through the field as the source is "observed"; each glyph
 *  lights up as the beam passes it. */
export function SignalSequence({ progress, steps, totalSeconds }: { progress: number; steps: SignalStep[]; totalSeconds: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const points: TimedPoint[] = steps.map((s) => ({ t: s.elapsedSeconds, value: s.value }));
  const maxValue = Math.max(...points.map((pt) => pt.value), 1);
  const path = buildSmoothPath(points, { ...BOX, maxValue });

  // Entrance / exit envelope on top of the underlying signal shape, so the
  // field visibly grows in and empties out rather than snapping to full
  // opacity for the whole sequence.
  const entrance = ease("enter", Math.min(1, p / 0.08));
  const exit = ease("exit", Math.max(0, (p - 0.9) / 0.1));
  const envelope = entrance * (1 - exit);

  const elapsedOriginal = p * totalSeconds;
  const head = playheadAt(points, elapsedOriginal, { ...BOX, maxValue });
  const beamX = Math.max(0, Math.min(BOX.width, head.x));
  const currentValue = valueAtTime(points, elapsedOriginal);

  const areaPath = `${path} L${BOX.width},${BOX.height} L0,${BOX.height} Z`;

  return (
    <div className="wow-stage-layer wow-signal-layer" aria-hidden="true" style={{ opacity: envelope }}>
      <svg className="wow-signal-svg" viewBox={`0 0 ${BOX.width} ${BOX.height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="wow-signal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--violet-light)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--violet-deep)" stopOpacity="0.02" />
          </linearGradient>
          <filter id="wow-signal-glow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <path d={areaPath} fill="url(#wow-signal-fill)" stroke="none" />
        <path d={path} fill="none" stroke="var(--violet-light)" strokeWidth="4" opacity="0.35" filter="url(#wow-signal-glow)" />
        <path d={path} fill="none" stroke="var(--violet-light)" strokeWidth="2.5" opacity="0.95" />
        {p < 0.995 && (
          <line x1={beamX} y1="0" x2={beamX} y2={BOX.height} stroke="var(--text)" strokeWidth="1.5" opacity="0.5" />
        )}
      </svg>
      <div className="wow-signal-glyphs">
        {steps.map((s) => {
          const lit = Math.abs(elapsedOriginal - s.elapsedSeconds) < totalSeconds * 0.06;
          const xPct = (s.elapsedSeconds / totalSeconds) * 100;
          return (
            <span
              key={s.label}
              className={`wow-signal-glyph${lit ? " is-lit" : ""}`}
              style={{ left: `${Math.min(97, Math.max(3, xPct))}%` }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
      <div className="wow-signal-readout" aria-hidden="true">
        {Math.round((currentValue / maxValue) * 100)}%
      </div>
    </div>
  );
}
