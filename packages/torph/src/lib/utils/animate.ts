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

  pending.set(element, { stop: () => clearTimeout(timer), onCancel });
}
