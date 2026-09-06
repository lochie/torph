import { cancelAnimations, fadeDuration } from "../../utils/animate";

// An element is swapped whole rather than re-lettered, so it recedes further than a
// glyph settling (0.95) or a run of them receding (0.8) — it is one thing traded for
// another, and reads as a crossfade in place.
const ELEMENT_SCALE = 0.6;
// The outgoing element is well on its way before its replacement starts arriving.
const ELEMENT_DELAY = 1 / 6;

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

/**
 * A segment that stays put while its wrapper changes has nothing to move, so the
 * colour is the whole gesture. Only what interpolates is animated — a weight or a
 * family still snaps, and should.
 */
export function animateFormatChange(
  element: HTMLElement,
  options: { from: string; duration: number; ease: string },
) {
  const { from, duration, ease } = options;
  // The second keyframe is empty on purpose: it resolves to whatever the rebuilt
  // wrapper computes to, which is the point of reading the old value first.
  element.animate([{ color: from }, {}], {
    duration,
    easing: ease,
    fill: "backwards",
  });
}

export function animateElementExit(
  child: HTMLElement,
  options: { dx: number; dy: number; duration: number; ease: string },
) {
  const { dx, dy, duration, ease } = options;

  child.animate(
    {
      transform: `translate(${dx}px, ${dy}px) scale(${ELEMENT_SCALE})`,
      offset: 1,
    },
    { duration, easing: ease, fill: "both" },
  );

  const fadeAnimation = child.animate(
    { opacity: 0, offset: 1 },
    { duration: fadeDuration(duration, 0.45), easing: "linear", fill: "both" },
  );

  fadeAnimation.onfinish = () => child.remove();
}

export function animateElementEnter(
  child: HTMLElement,
  options: { deltaX: number; deltaY: number; duration: number; ease: string },
) {
  const { deltaX, deltaY, duration, ease } = options;

  const prev = cancelAnimations(child);
  // `fill: both` holds the first frame through the delay, so it waits small and clear.
  const delay = duration * ELEMENT_DELAY;

  child.animate(
    [
      {
        transform: `translate(${deltaX + prev.tx}px, ${deltaY + prev.ty}px) scale(${ELEMENT_SCALE})`,
      },
      { transform: "none" },
    ],
    { duration, delay, easing: ease, fill: "both" },
  );

  child.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: fadeDuration(duration, 0.35),
    delay,
    easing: "linear",
    fill: "both",
  });
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
