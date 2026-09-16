import { useState } from "react";

import type { RabbitHole } from "../../api";
import { RabbitHoleMedia, type MediaHotspot } from "../../components/rabbithole/RabbitHoleMedia";
import { buildSmoothPath, playheadAt, type TimedPoint } from "./interpolate";
import type { PassLabels } from "./stage/SecondPassSequence";
import type { SignalStep } from "./stage/SignalSequence";

const BOX = { width: 900, height: 220 };

/** The reduced-motion / unsupported-browser equivalent of the animated
 *  stage: the same three moments as discrete, control-equivalent states
 *  rather than a playable timeline -- nothing here is hidden or degraded
 *  in informational terms, only in motion. Artifact: a real, clickable
 *  hotspot instead of a scanning extraction. Signal: six selectable
 *  samples over a static (fully drawn, not growing) curve instead of a
 *  sweeping reconstruction. Second pass: both outcomes shown at once
 *  instead of a compressed wait. */
export function WowReducedStage({
  rh,
  hotspots,
  replaySteps,
  passLabels,
  reduced,
}: {
  rh: RabbitHole;
  hotspots: MediaHotspot[];
  replaySteps: SignalStep[];
  passLabels: PassLabels;
  reduced: boolean;
}) {
  const [foundGlyphs, setFoundGlyphs] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const points: TimedPoint[] = replaySteps.map((s) => ({ t: s.elapsedSeconds, value: s.value }));
  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const path = buildSmoothPath(points, { ...BOX, maxValue });
  const active = replaySteps[activeIdx];
  const head = playheadAt(points, active.elapsedSeconds, { ...BOX, maxValue });

  return (
    <div className="wow-stage wow-stage--reduced" data-reduced-motion={reduced || undefined}>
      <div className="wow-reduced-block">
        <p className="wow-reduced-label">The artifact</p>
        <RabbitHoleMedia items={rh.media} hotspots={hotspots} onActivateHotspot={() => setFoundGlyphs(true)} />
        <div className={`wow-glyph-reveal${foundGlyphs ? " is-shown" : ""}`} aria-hidden={!foundGlyphs}>
          {["6", "E", "Q", "U", "J", "5"].map((c) => (
            <span className="wow-glyph-reveal-char" key={c}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="wow-reduced-block">
        <p className="wow-reduced-label">The signal -- six samples</p>
        <svg className="wow-signal-svg" viewBox={`0 0 ${BOX.width} ${BOX.height}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="var(--violet-light)" strokeWidth="2.5" opacity="0.9" />
          <circle cx={head.x} cy={head.y} r="6" fill="var(--violet-light)" />
        </svg>
        <div className="wow-reduced-samples" role="group" aria-label="The six samples">
          {replaySteps.map((s, i) => (
            <button
              type="button"
              key={s.label}
              className={`wow-reduced-sample${i === activeIdx ? " is-active" : ""}`}
              aria-pressed={i === activeIdx}
              onClick={() => setActiveIdx(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="wow-reduced-readout">
          <strong>{active.valueLabel}</strong>
        </p>
      </div>

      <div className="wow-reduced-block">
        <p className="wow-reduced-label">The second pass</p>
        <div className="wow-reduced-passes">
          <div className="wow-reduced-pass">
            <span className="wow-reduced-pass-label">{passLabels.firstLabel}</span>
            <span className="wow-reduced-pass-state">{passLabels.firstState}</span>
          </div>
          <div className="wow-reduced-pass wow-reduced-pass--miss">
            <span className="wow-reduced-pass-label">{passLabels.secondLabel}</span>
            <span className="wow-reduced-pass-state">{passLabels.secondState}</span>
          </div>
        </div>
        <p className="wow-reduced-absence">{passLabels.absence}</p>
      </div>
    </div>
  );
}
