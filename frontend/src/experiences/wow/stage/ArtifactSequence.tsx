import { ease } from "../motion";

const GLYPHS = ["6", "E", "Q", "U", "J", "5"];

export interface ArtifactRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Sequence 1 -- THE ARTIFACT. A single authored timeline (driven by a
 *  pure `progress` 0..1, not scroll): the real printout settles in, a
 *  scan sweeps across it, locks onto the measured 6EQUJ5 region while the
 *  rest of the paper darkens, the six characters extract into large
 *  typography, and the paper recedes -- handing off to the signal
 *  sequence, which opens on the same six glyphs at rest. Pure function of
 *  `progress`: safe to scrub, reverse, or resume from any point. */
export function ArtifactSequence({
  progress,
  region,
  imageUrl,
  imageAlt,
}: {
  progress: number;
  region: ArtifactRegion;
  imageUrl: string;
  imageAlt: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const focusX = region.left + region.width / 2;
  const focusY = region.top + region.height / 2;

  // Entrance
  const entrance = clamp01((p - 0) / 0.12);
  const imgOpacity = ease("enter", entrance);
  const imgScale = 0.97 + 0.03 * ease("enter", entrance);

  // Scan sweep, then lock onto the hotspot
  const sweep = clamp01((p - 0.1) / 0.32); // 0.10 - 0.42
  const lock = clamp01((p - 0.42) / 0.16); // 0.42 - 0.58
  const scanX = sweep < 1 ? ease("move", sweep) * 100 : lerp(100, focusX, ease("move", lock));
  const scanVisible = p >= 0.1 && p < 0.62;

  // Darken mask
  const maskOpacity = ease("move", clamp01((p - 0.4) / 0.22)) * 0.88; // 0.40 - 0.62

  // Glyph extraction
  const glyphIn = clamp01((p - 0.55) / 0.25); // 0.55 - 0.80
  const glyphOpacity = ease("enter", glyphIn);
  const glyphScale = 0.7 + 0.3 * ease("enter", glyphIn);

  // Recede
  const recede = clamp01((p - 0.8) / 0.2); // 0.80 - 1.0
  const paperOpacity = imgOpacity * (1 - 0.7 * ease("exit", recede));
  const finalGlyphScale = glyphScale + 0.25 * ease("move", recede);

  return (
    <div className="wow-stage-layer wow-artifact-layer" aria-hidden="true">
      <div
        className="wow-artifact-frame"
        style={{ opacity: paperOpacity, transform: `scale(${imgScale})` }}
      >
        <img src={imageUrl} alt={imageAlt} className="wow-artifact-img" />
        {scanVisible && (
          <div className="wow-artifact-scan" style={{ left: `${scanX}%` }} />
        )}
        <div
          className="wow-artifact-darken"
          style={{
            opacity: maskOpacity,
            background: `radial-gradient(circle at ${focusX}% ${focusY}%, transparent 0%, transparent 14%, rgba(5,5,8,0.94) 55%)`,
          }}
        />
      </div>
      {glyphIn > 0 && (
        <div
          className="wow-artifact-glyphs"
          style={{
            left: `${focusX}%`,
            top: `${focusY}%`,
            opacity: glyphOpacity,
            transform: `translate(-50%, -50%) scale(${finalGlyphScale})`,
          }}
        >
          {GLYPHS.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
