import { parseEasing, slopeAt } from "./easing";
import type { EasingFn } from "./easing";

// A share of the morph, never a fixed length — a cap here leaves a character opaque
// and motionless for the rest of a long duration.
export function fadeDuration(duration: number, fraction: number): number {
  return duration * fraction;
}

export function parseTranslate(element: HTMLElement): {
  tx: number;
  ty: number;
} {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return { tx: 0, ty: 0 };
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return { tx: 0, ty: 0 };
  const v = match[1]!.split(",").map(Number);
  return { tx: v[4] || 0, ty: v[5] || 0 };
}

// The box a `width`/`height` write means. `getBoundingClientRect` is the visual box, so
// a rotated or scaled ancestor inflates it — and the container transition writes what it
// measures straight back, compounding every morph.
export function layoutSize(element: HTMLElement): {
  width: number;
  height: number;
} {
  const style = getComputedStyle(element);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  if (Number.isNaN(width) || Number.isNaN(height)) {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
  return { width, height };
}

export function cancelAnimations(element: HTMLElement): {
  tx: number;
  ty: number;
  opacity: number;
} {
  const { tx, ty } = parseTranslate(element);
  const opacity = Number(getComputedStyle(element).opacity) || 1;
  element.getAnimations().forEach((a) => a.cancel());
  return { tx, ty, opacity };
}

type PendingTransition = {
  stop: () => void;
  onCancel?: () => void;
  /** Read before the abort, while the animations are still running. */
  snapshot: () => { width: AxisState; height: AxisState };
};

type Axis = {
  anim: Animation;
  from: number;
  to: number;
  easing: string;
  /** The curve actually in effect, carry included. */
  curve: EasingFn | null;
  /** When the curve notionally began, so elapsed survives a resume. */
  startedAt: number;
};

/** An axis mid-flight: where it was headed, how far it got, how fast it was going. */
type AxisState = {
  from: number;
  to: number;
  easing: string;
  curve: EasingFn | null;
  /** null once settled or cancelled — nothing to resume or carry. */
  elapsed: number | null;
  velocity: number;
};

// Normalised velocity is distance-relative, so a near-zero distance would launch the
// box across the screen. These bound that, and the overshoot the carry can produce.
const CARRY_MAX = 8;
const CARRY_OVERSHOOT = 0.1;
const CARRY_MIN_DELTA = 0.5;

// Measurement noise, not a moved target.
const SAME_TARGET = 0.5;

/**
 * Not `anim.currentTime`: a fresh animation is play-pending with an unresolved start
 * time, so seeking it sets a hold time that reads back unchanged until it is ready on
 * the next frame. Resuming once a frame lands exactly on that boundary, and elapsed
 * would stop accumulating — the box would sit still while the curve was replaced.
 */
const now = () => performance.now();

/**
 * The author's curve, leaving at the speed the box is already travelling.
 *
 * A morph arriving mid-transition restarts the curve at t=0, so a fast run of them
 * only ever plays each curve's opening sliver — the box crawls while the value races
 * ahead. Adding `k · t(1-t)^m` fixes the start slope to the carried velocity without
 * moving either endpoint; `m` narrows as `k` grows, holding the peak inside
 * CARRY_OVERSHOOT. Momentum is only ever added, never subtracted: a curve that starts
 * faster than the box was moving is the author's business, and slowing it to match
 * would make a value that had settled start sluggishly.
 */
export function carry(
  base: EasingFn,
  normalisedVelocity: number,
): { curve: EasingFn; k: number } {
  // `Math.max(0, NaN)` is NaN and `NaN <= 0` is false, so the guard has to be positive.
  const k = Math.max(
    0,
    Math.min(CARRY_MAX, normalisedVelocity) - slopeAt(base, 0),
  );
  if (!(k > 0)) return { curve: base, k: 0 };

  const bump = Math.max(3, Math.ceil(k / (Math.E * CARRY_OVERSHOOT)) - 1);
  return {
    curve: (t) => (t >= 1 ? 1 : base(t) + k * t * Math.pow(1 - t, bump)),
    k,
  };
}

/** Sampled fine enough that a segment is shorter than a frame at 120Hz. */
export function sampleEasing(curve: EasingFn, duration: number): string {
  const points = Math.min(120, Math.max(32, Math.round(duration / 8)));
  const values: string[] = [];
  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1);
    const value = i === points - 1 ? 1 : curve(t);
    values.push(`${Math.round(value * 10000) / 10000}`);
  }
  return `linear(${values.join(", ")})`;
}

function animateAxis(
  element: HTMLElement,
  property: "width" | "height",
  from: number,
  to: number,
  previous: AxisState | undefined,
  duration: number,
  ease: string,
  base: EasingFn | null,
): Axis {
  const run = (
    from: number,
    to: number,
    easing: string,
    curve: EasingFn | null,
    seek?: number,
  ): Axis => {
    const anim = element.animate(
      [{ [property]: `${from}px` }, { [property]: `${to}px` }],
      { duration, easing, fill: "both" },
    );
    if (seek !== undefined) anim.currentTime = seek;
    return { anim, from, to, easing, curve, startedAt: now() - (seek ?? 0) };
  };

  /**
   * The target has not moved, so the curve already in flight is still the right one —
   * resumed at the phase it had reached rather than started over. A value updated
   * faster than the morph settles restarts this every frame, and a curve that is slow
   * to leave never gets past its opening sliver: the box crawls while the text races
   * ahead. Nothing to carry here, because nothing was interrupted.
   */
  if (
    previous &&
    previous.elapsed !== null &&
    Math.abs(previous.to - to) < SAME_TARGET
  ) {
    return run(
      previous.from,
      previous.to,
      previous.easing,
      previous.curve,
      previous.elapsed,
    );
  }

  const delta = to - from;
  let easing = ease;
  let curve = base;

  if (base && Math.abs(delta) > CARRY_MIN_DELTA) {
    const carried = carry(base, ((previous?.velocity ?? 0) * duration) / delta);
    if (carried.k > 0) {
      curve = carried.curve;
      easing = sampleEasing(carried.curve, duration);
    }
  }

  return run(from, to, easing, curve);
}

function axisState(axis: Axis, duration: number): AxisState {
  // A cancelled animation has nothing left to resume or carry, and reads back as null.
  const gone = axis.anim.currentTime === null;
  const run = now() - axis.startedAt;
  const settled = gone || !Number.isFinite(run) || run >= duration || run < 0;
  const elapsed = settled ? null : run;

  return {
    from: axis.from,
    to: axis.to,
    easing: axis.easing,
    curve: axis.curve,
    elapsed,
    velocity:
      elapsed === null || !axis.curve
        ? 0
        : ((axis.to - axis.from) * slopeAt(axis.curve, elapsed / duration)) /
          duration,
  };
}

const pending = new WeakMap<HTMLElement, PendingTransition>();

function inFlight(element: HTMLElement) {
  return pending.get(element)?.snapshot();
}

/**
 * Releases the size to the author's CSS rather than pinning it to `auto` — an inline
 * style outranks a stylesheet, so `auto` would override the page for good and a root
 * set to `width: 100%` would shrink to its content on the first morph.
 */
function restoreSize(element: HTMLElement) {
  element.style.width = "";
  element.style.height = "";
  element.style.transitionProperty = "";
}

// A running transition's `fill: "both"` outranks inline styles, so stop it first.
export function abortContainerTransition(element: HTMLElement) {
  const entry = pending.get(element);
  if (!entry) return;
  pending.delete(element);
  entry.stop();
  entry.onCancel?.();
}

// Fires neither callback — teardown is not an animation event.
export function clearContainerTransition(element: HTMLElement) {
  const entry = pending.get(element);
  if (entry) {
    pending.delete(element);
    entry.stop();
  }
  restoreSize(element);
}

export function transitionContainerSize(
  element: HTMLElement,
  oldWidth: number,
  oldHeight: number,
  duration: number,
  ease: string,
  onComplete?: () => void,
  onCancel?: () => void,
) {
  // Read before the abort, off the curves the box is still riding.
  const previous = inFlight(element);
  abortContainerTransition(element);

  if (oldWidth === 0 || oldHeight === 0) {
    restoreSize(element);
    onCancel?.();
    return;
  }

  // WAAPI drives the size instead, sharing a start time with the items. Cleared, not
  // set to `auto`, so what gets measured is the size the author's CSS asks for.
  element.style.transitionProperty = "none";
  element.style.width = "";
  element.style.height = "";
  void element.offsetWidth;

  const { width: newWidth, height: newHeight } = layoutSize(element);
  const base = parseEasing(ease);

  // One per axis: each carries its own momentum, so they need their own curves.
  const width = animateAxis(
    element,
    "width",
    oldWidth,
    newWidth,
    previous?.width,
    duration,
    ease,
    base,
  );
  const height = animateAxis(
    element,
    "height",
    oldHeight,
    newHeight,
    previous?.height,
    duration,
    ease,
    base,
  );

  const stop = () => {
    width.anim.cancel();
    height.anim.cancel();
  };

  width.anim.onfinish = () => {
    pending.delete(element);
    stop();
    restoreSize(element);
    onComplete?.();
  };

  pending.set(element, {
    stop,
    onCancel,
    snapshot: () => ({
      width: axisState(width, duration),
      height: axisState(height, duration),
    }),
  });
}

// An emptied value has nothing left to size to, so the container would collapse and
// drag the exiting text with it when centred.
export function holdContainerSize(
  element: HTMLElement,
  width: number,
  height: number,
  duration: number,
  onComplete?: () => void,
  onCancel?: () => void,
) {
  abortContainerTransition(element);

  element.style.transitionProperty = "none";
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;

  const timer = setTimeout(() => {
    pending.delete(element);
    restoreSize(element);
    onComplete?.();
  }, duration);

  // Pinned, not animated — there is no motion to hand on.
  const held = (value: number): AxisState => ({
    from: value,
    to: value,
    easing: "linear",
    curve: null,
    elapsed: null,
    velocity: 0,
  });
  pending.set(element, {
    stop: () => clearTimeout(timer),
    onCancel,
    snapshot: () => ({ width: held(width), height: held(height) }),
  });
}
