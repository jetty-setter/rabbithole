import { ease } from "../motion";

const COUNTDOWN = ["02:52", "02:12", "01:36", "00:58", "00:18", "00:00"];

export interface PassLabels {
  firstLabel: string;
  firstState: string;
  secondLabel: string;
  secondState: string;
  timing: string;
  waiting: string;
  absence: string;
}

function bumpCurve(x: number, center: number, width: number, height: number): number {
  const d = (x - center) / width;
  return Math.max(0, 1 - d * d) * height;
}

/** Sequence 3 -- THE SECOND PASS. The stage resets into a spatial
 *  observing view: a fixed "expected response window" the source crosses
 *  twice. First pass -- the source enters, a signal visibly rises, peaks,
 *  falls (violet: observed data). Then time itself compresses (a
 *  countdown sweeping 02:52 -> 00:00 alongside a draining ring, not a
 *  literal wait). Second pass -- the source re-enters the same window,
 *  but the field stays flat: the absence IS the visual event, held
 *  before "NO SECOND DETECTION" lands on coral -- missing expectation,
 *  not a UI error state. */
export function SecondPassSequence({ progress, labels }: { progress: number; labels: PassLabels }) {
  const p = Math.max(0, Math.min(1, progress));
  const W = 900;
  const H = 220;
  const windowX = W * 0.62;
  const windowW = 130;

  // First pass: 0 - 0.28
  const firstP = clamp01(p / 0.28);
  const firstSourceX = ease("move", firstP) * W;
  const firstDetected = firstP > 0.85;

  // Time compression: 0.28 - 0.6
  const compressP = clamp01((p - 0.28) / 0.32);
  const countdownIdx = Math.min(COUNTDOWN.length - 1, Math.floor(ease("move", compressP) * COUNTDOWN.length));
  const ringProgress = 1 - ease("move", compressP);

  // Second pass: 0.6 - 0.85
  const secondP = clamp01((p - 0.6) / 0.25);
  const secondSourceX = ease("move", secondP) * W;

  // Payoff: 0.85 - 1
  const payoffP = clamp01((p - 0.87) / 0.13);
  const payoffOpacity = ease("enter", payoffP);

  const inFirstPass = p < 0.28;
  const inCompression = p >= 0.28 && p < 0.6;
  const inSecondPass = p >= 0.6 && p < 0.87;
  const inPayoff = p >= 0.87;

  const firstCurveHeight = inFirstPass ? bumpCurve(firstSourceX, windowX, windowW, H * 0.62) * ease("enter", firstP) : 0;

  return (
    <div className="wow-stage-layer wow-secondpass-layer" aria-hidden="true">
      <svg className="wow-secondpass-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <rect x={windowX - windowW / 2} y={0} width={windowW} height={H} className="wow-secondpass-window" />
        {inFirstPass && (
          <>
            <path
              d={`M0,${H} L${W},${H}`}
              stroke="var(--violet-deep)"
              strokeWidth="2"
              opacity="0.4"
              fill="none"
            />
            <path
              d={buildBumpPath(firstSourceX, windowX, windowW, H, firstCurveHeight)}
              fill="none"
              stroke="var(--violet-light)"
              strokeWidth="3"
            />
            <circle cx={firstSourceX} cy={H - firstCurveHeight - 4} r="5" fill="var(--violet-light)" />
          </>
        )}
        {inSecondPass && (
          <>
            <path d={`M0,${H} L${W},${H}`} stroke="var(--coral)" strokeWidth="2" opacity="0.55" fill="none" />
            <circle cx={secondSourceX} cy={H - 4} r="5" fill="var(--coral)" />
          </>
        )}
      </svg>

      {inFirstPass && (
        <div className="wow-secondpass-label wow-secondpass-label--first">
          <span className="wow-secondpass-eyebrow">{labels.firstLabel}</span>
          <span className="wow-secondpass-state">{firstDetected ? labels.firstState : ""}</span>
        </div>
      )}

      {inCompression && (
        <div className="wow-secondpass-compress">
          <svg className="wow-secondpass-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" className="wow-secondpass-ring-track" />
            <circle
              cx="50"
              cy="50"
              r="42"
              className="wow-secondpass-ring-fill"
              style={{ strokeDashoffset: `${(1 - ringProgress) * 264}` }}
            />
          </svg>
          <span className="wow-secondpass-countdown">{COUNTDOWN[countdownIdx]}</span>
          <span className="wow-secondpass-waiting">{labels.waiting}</span>
        </div>
      )}

      {inSecondPass && (
        <div className="wow-secondpass-label wow-secondpass-label--second">
          <span className="wow-secondpass-eyebrow">{labels.secondLabel}</span>
        </div>
      )}

      {inPayoff && (
        <div className="wow-secondpass-payoff" style={{ opacity: payoffOpacity }}>
          {labels.absence}
        </div>
      )}
    </div>
  );
}

function buildBumpPath(sourceX: number, windowX: number, windowW: number, height: number, peakHeight: number): string {
  const pts: string[] = [];
  const samples = 40;
  for (let i = 0; i <= samples; i++) {
    const x = (sourceX / samples) * i;
    const y = height - bumpCurve(x, windowX, windowW, peakHeight);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
