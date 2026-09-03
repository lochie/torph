/**
 * Evaluating a CSS easing in JS, so an interrupted animation can be asked how
 * fast it was travelling at the moment it was replaced. Only the forms the
 * library can hand out are understood; anything else returns null, and the
 * caller falls back to starting the next animation from rest.
 */

export type EasingFn = (t: number) => number;

const KEYWORDS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const axis = (p1: number, p2: number, t: number) => {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
};

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (axis(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return axis(y1, y2, (lo + hi) / 2);
  };
}

/** Positions left out are spread evenly between the nearest given ones. */
function fillStops(stops: (number | null)[]): number[] {
  const filled = [...stops];
  if (filled[0] === null || filled[0] === undefined) filled[0] = 0;
  if (filled[filled.length - 1] === null) filled[filled.length - 1] = 1;

  for (let i = 1; i < filled.length; i += 1) {
    if (filled[i] !== null) continue;
    let next = i;
    while (filled[next] === null) next += 1;
    const start = filled[i - 1]!;
    const step = (filled[next]! - start) / (next - i + 1);
    for (let j = i; j < next; j += 1) filled[j] = start + step * (j - i + 1);
  }

  // Monotonic, so a segment can never span backwards.
  return filled.map((stop, i, all) =>
    i === 0 ? stop! : Math.max(stop!, all[i - 1]!),
  ) as number[];
}

function linearEasing(body: string): EasingFn | null {
  const values: number[] = [];
  const stops: (number | null)[] = [];

  for (const part of body.split(",")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const value = Number(tokens[0]);
    if (!Number.isFinite(value)) return null;

    const percents = tokens.slice(1);
    if (percents.length > 2) return null;
    if (percents.length === 0) {
      values.push(value);
      stops.push(null);
      continue;
    }
    // Two stops hold the value across the span between them.
    for (const percent of percents) {
      if (!percent.endsWith("%")) return null;
      const stop = Number(percent.slice(0, -1));
      if (!Number.isFinite(stop)) return null;
      values.push(value);
      stops.push(stop / 100);
    }
  }

  if (values.length < 2) return null;
  const positions = fillStops(stops);

  return (t) => {
    if (t <= positions[0]!) return values[0]!;
    const last = positions.length - 1;
    if (t >= positions[last]!) return values[last]!;

    let i = 0;
    while (i < last && positions[i + 1]! < t) i += 1;
    const span = positions[i + 1]! - positions[i]!;
    if (span === 0) return values[i + 1]!;
    return (
      values[i]! + ((values[i + 1]! - values[i]!) * (t - positions[i]!)) / span
    );
  };
}

export function parseEasing(ease: string): EasingFn | null {
  const value = ease.trim().toLowerCase();

  const keyword = KEYWORDS[value];
  if (keyword) return cubicBezier(...keyword);

  const bezier = /^cubic-bezier\(([^)]*)\)$/.exec(value);
  if (bezier) {
    const n = bezier[1]!.split(",").map((part) => Number(part.trim()));
    if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
    return cubicBezier(n[0]!, n[1]!, n[2]!, n[3]!);
  }

  const linear = /^linear\(([^)]*)\)$/.exec(value);
  if (linear) return linearEasing(linear[1]!);

  return null;
}

const H = 1e-4;

/** Progress per unit of normalised time. Forward, so a knot reports the segment ahead. */
export function slopeAt(easing: EasingFn, t: number): number {
  const a = Math.min(Math.max(t, 0), 1 - H);
  return (easing(a + H) - easing(a)) / H;
}
