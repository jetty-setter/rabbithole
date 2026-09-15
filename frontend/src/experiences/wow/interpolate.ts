export interface TimedPoint {
  t: number;
  value: number;
}

/** Catmull-Rom interpolation through a set of (time, value) points -- lets
 *  the six discrete samples read as one continuous observation rather than
 *  a step function. Clamped to the first/last point outside the range. */
export function valueAtTime(points: TimedPoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0].t) return points[0].value;
  if (t >= points[points.length - 1].t) return points[points.length - 1].value;

  let i = 0;
  while (i < points.length - 2 && points[i + 1].t < t) i++;

  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(points.length - 1, i + 2)];

  const span = p2.t - p1.t || 1;
  const local = (t - p1.t) / span;
  const l2 = local * local;
  const l3 = l2 * local;

  return (
    0.5 *
    (2 * p1.value +
      (-p0.value + p2.value) * local +
      (2 * p0.value - 5 * p1.value + 4 * p2.value - p3.value) * l2 +
      (-p0.value + 3 * p1.value - 3 * p2.value + p3.value) * l3)
  );
}

/** Densely samples the interpolated curve into an SVG path string, mapped
 *  into a `width` x `height` viewBox (value 0 at the bottom). `maxValue`
 *  sets what maps to the top of the box. */
export function buildSmoothPath(
  points: TimedPoint[],
  opts: { width: number; height: number; maxValue: number; samples?: number },
): string {
  const { width, height, maxValue, samples = 120 } = opts;
  if (points.length === 0) return "";
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const span = tMax - tMin || 1;

  const coords: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = tMin + (i / samples) * span;
    const v = valueAtTime(points, t);
    const x = ((t - tMin) / span) * width;
    const y = height - Math.max(0, Math.min(1, v / maxValue)) * height;
    coords.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return coords.join(" ");
}

/** Where the playhead sits for a given elapsed time, in the same box the
 *  path above was built for. */
export function playheadAt(
  points: TimedPoint[],
  t: number,
  opts: { width: number; height: number; maxValue: number },
): { x: number; y: number } {
  const { width, height, maxValue } = opts;
  const tMin = points[0]?.t ?? 0;
  const tMax = points[points.length - 1]?.t ?? 1;
  const span = tMax - tMin || 1;
  const v = valueAtTime(points, t);
  return {
    x: ((t - tMin) / span) * width,
    y: height - Math.max(0, Math.min(1, v / maxValue)) * height,
  };
}
