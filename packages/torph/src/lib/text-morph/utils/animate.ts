const MAX_FADE_DURATION = 150;

function fadeDuration(duration: number, fraction: number): number {
  return Math.min(duration * fraction, MAX_FADE_DURATION);
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

function cancelAnimations(element: HTMLElement): {
  tx: number;
  ty: number;
  opacity: number;
} {
  const { tx, ty } = parseTranslate(element);
  const opacity = Number(getComputedStyle(element).opacity) || 1;
  element.getAnimations().forEach((a) => a.cancel());
  return { tx, ty, opacity };
}

export function animateExit(
  child: HTMLElement,
  options: {
    dx: number;
    dy: number;
    duration: number;
    ease: string;
    scale: boolean;
  },
) {
  const { dx, dy, duration, ease, scale } = options;

  child.animate(
    {
      transform: scale
        ? `translate(${dx}px, ${dy}px) scale(0.95)`
        : `translate(${dx}px, ${dy}px)`,
      offset: 1,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  const fadeAnimation = child.animate(
    {
      opacity: 0,
      offset: 1,
    },
    {
      duration: fadeDuration(duration, 0.25),
      easing: "linear",
      fill: "both",
    },
  );

  fadeAnimation.onfinish = () => child.remove();
}

export function animateEnterOrPersist(
  child: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    isNew: boolean;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, isNew, duration, ease } = options;

  const prev = cancelAnimations(child);

  const startX = deltaX + prev.tx;
  const startY = deltaY + prev.ty;
  const startOpacity = isNew && prev.opacity >= 1 ? 0 : prev.opacity;

  child.animate(
    [
      {
        transform: `translate(${startX}px, ${startY}px) scale(${isNew ? 0.95 : 1})`,
      },
      { transform: "none" },
    ],
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  if (startOpacity < 1) {
    child.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: fadeDuration(duration, isNew ? 0.5 : 0.25),
      delay: isNew ? fadeDuration(duration, 0.25) : 0,
      easing: "linear",
      fill: "both",
    });
  }
}

/**
 * The container transition currently running on an element.
 *
 * `stop` drops whatever is driving the size — a WAAPI animation or a timer —
 * without deciding how the morph should be reported. That call is the
 * caller's: a superseded morph cancels, teardown reports nothing at all.
 */
type PendingTransition = {
  stop: () => void;
  onCancel?: () => void;
};

const pending = new WeakMap<HTMLElement, PendingTransition>();

/** Hands the element's size and transitions back to the page. */
function restoreSize(element: HTMLElement) {
  element.style.width = "auto";
  element.style.height = "auto";
  element.style.transitionProperty = "";
}

/**
 * Stops a running container transition and reports the morph as cancelled.
 *
 * A running transition uses `fill: "both"`, which outranks inline styles, so
 * anything setting width/height directly has to stop it first. The size is
 * left where it is — the caller is about to set its own.
 */
export function abortContainerTransition(element: HTMLElement) {
  const entry = pending.get(element);
  if (!entry) return;
  pending.delete(element);
  entry.stop();
  entry.onCancel?.();
}

/**
 * Stops a running container transition and gives the element its own size
 * back. Fires neither callback — teardown is not an animation event.
 */
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

  // Disable CSS transitions — we use WAAPI for exact sync with item animations
  element.style.transitionProperty = "none";
  element.style.width = "auto";
  element.style.height = "auto";
  void element.offsetWidth;

  const newRect = element.getBoundingClientRect();
  const newWidth = newRect.width;
  const newHeight = newRect.height;

  // Use WAAPI to animate width/height in perfect sync with item transforms
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

/**
 * Pins the container at a fixed size for the length of a morph.
 *
 * Used when the new value is empty: there is no new content to size the
 * container to while the exits play, so it would otherwise collapse and drag
 * the exiting text with it — visibly so under `text-align: center`.
 */
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
