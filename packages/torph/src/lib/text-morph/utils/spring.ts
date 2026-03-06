export interface SpringParams {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
}

export interface SpringResult {
  easing: string;
  duration: number;
}

function springPosition(
  t: number,
  omega0: number,
  zeta: number,
): number {
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * omega0 * t) *
        (Math.cos(omegaD * t) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * t))
    );
  }

  // Overdamped (includes near-critically-damped)
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta + s);
  const r2 = -omega0 * (zeta - s);
  const B = -r1 / (r2 - r1);
  const A = 1 - B;
  return 1 - A * Math.exp(r1 * t) - B * Math.exp(r2 * t);
}

function computeDuration(
  omega0: number,
  zeta: number,
  precision: number,
): number {
  const step = 0.001;
  const maxDuration = 10;
  let settledSince = 0;

  for (let t = 0; t < maxDuration; t += step) {
    if (Math.abs(springPosition(t, omega0, zeta) - 1) > precision) {
      settledSince = 0;
    } else {
      settledSince += step;
      if (settledSince > 0.1) {
        return Math.ceil((t - settledSince + step) * 1000);
      }
    }
  }

  return Math.ceil(maxDuration * 1000);
}

const cache = new Map<string, SpringResult>();

export function spring(params?: SpringParams): SpringResult {
  const {
    stiffness = 100,
    damping = 10,
    mass = 1,
    precision = 0.001,
  } = params ?? {};

  const key = `${stiffness}:${damping}:${mass}:${precision}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const duration = computeDuration(omega0, zeta, precision);
  const numPoints = Math.min(100, Math.max(32, Math.round(duration / 15)));

  const points: string[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * (duration / 1000);
    const value = i === numPoints - 1 ? 1 : springPosition(t, omega0, zeta);
    points.push(Math.round(value * 10000) / 10000 + "");
  }

  // Trim trailing "1" values (keep at least 2)
  while (points.length > 2 && points[points.length - 2] === "1") {
    points.splice(points.length - 2, 1);
  }

  const result: SpringResult = {
    easing: `linear(${points.join(", ")})`,
    duration,
  };

  cache.set(key, result);
  return result;
}
