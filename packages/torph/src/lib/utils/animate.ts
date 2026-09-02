/**
 * A fade is a share of the morph, never a fixed length.
 *
 * This used to cap at 150ms, which silently decoupled the two from each other:
 * at a 3000ms duration a character finished fading a tenth of the way through a
 * transform that still had 2850ms to run, so it sat there fully opaque and
 * motionless for the rest of it. The number animations never had the cap, so
 * the two families also disagreed at every speed.
 */
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
};

const pending = new WeakMap<HTMLElement, PendingTransition>();

/**
 * Releases the size back to whatever the author's CSS says, rather than pinning
 * it to `auto`.
 *
 * An inline style outranks any stylesheet rule, so writing `auto` here does not
 * restore anything — it overrides the page for good. A root told to be
 * `width: 100%` by its own CSS would shrink to its content on the first morph
 * and stay there, taking any `text-align` on it with it, because there is no
 * longer any spare width to align within.
 */
function restoreSize(element: HTMLElement) {
  element.style.width = "";
  element.style.height = "";
  element.style.transitionProperty = "";
}

// A running transition uses `fill: "both"`, which outranks inline styles, so
// anything setting width/height directly has to stop it first.
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
  abortContainerTransition(element);

  if (oldWidth === 0 || oldHeight === 0) {
    restoreSize(element);
    onCancel?.();
    return;
  }

  // WAAPI drives the size instead, so it shares a start time with the items.
  // Cleared rather than set to `auto`, so the target measured here is the size
  // the author's CSS actually asks for — a root pinned to `width: 100%` should
  // animate to that, which is to say not at all.
  element.style.transitionProperty = "none";
  element.style.width = "";
  element.style.height = "";
  void element.offsetWidth;

  const newRect = element.getBoundingClientRect();
  const newWidth = newRect.width;
  const newHeight = newRect.height;

  const anim = element.animate(
    [
      { width: `${oldWidth}px`, height: `${oldHeight}px` },
      { width: `${newWidth}px`, height: `${newHeight}px` },
    ],
    { duration, easing: ease, fill: "both" },
  );

  anim.onfinish = () => {
    pending.delete(element);
    anim.cancel();
    restoreSize(element);
    onComplete?.();
  };

  pending.set(element, { stop: () => anim.cancel(), onCancel });
}

// For an emptied value: nothing is left to size the container to, so without
// this it collapses and drags the exiting text with it when centred.
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

  pending.set(element, { stop: () => clearTimeout(timer), onCancel });
}
