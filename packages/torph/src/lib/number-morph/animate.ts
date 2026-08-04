import { parseTranslate, cancelAnimations } from "../utils/animate";

/**
 * Fades are a share of the morph rather than a fixed length, and the outgoing
 * share is the larger one: a digit that has already left is a hole in the
 * number, so it stays legible well into the slide, while the incoming digit
 * asserts itself early instead of ghosting in behind it.
 *
 * The block-axis mask is doing most of the work here — both sets of characters
 * are also being clipped as they cross the line box — so these only have to
 * soften the edges of that.
 */
const EXIT_FADE = 0.45;
const ENTER_FADE = 0.25;

export function animateNumberExit(
  child: HTMLElement,
  options: {
    dx: number;
    dy: number;
    slideDistance: number;
    duration: number;
    ease: string;
  },
) {
  const { dx, dy, slideDistance, duration, ease } = options;

  child.animate(
    {
      transform: `translate(${dx}px, ${dy + slideDistance}px)`,
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
      duration: duration * EXIT_FADE,
      easing: "linear",
      fill: "both",
    },
  );

  // Removal is the fade finishing, so the share above is also how long an
  // exiting character stays in the DOM.
  fadeAnimation.onfinish = () => child.remove();
}

export function animateNumberEnter(
  child: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    slideDistance: number;
    kind: "digit" | "symbol";
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, slideDistance, kind, duration, ease } = options;

  const prev = cancelAnimations(child);

  const slideOffset = kind === "digit" ? -slideDistance : slideDistance;
  const startX = deltaX + prev.tx;
  const startY = deltaY + prev.ty + slideOffset;

  child.animate(
    {
      transform: `translate(${startX}px, ${startY}px)`,
      offset: 0,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  const startOpacity = prev.opacity >= 1 ? 0 : prev.opacity;
  if (startOpacity < 1) {
    child.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: duration * ENTER_FADE,
      easing: "linear",
      fill: "both",
    });
  }
}

export function animateNumberPersist(
  child: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, duration, ease } = options;

  const { tx, ty } = parseTranslate(child);
  child.getAnimations().forEach((a) => a.cancel());

  const startX = deltaX + tx;
  const startY = deltaY + ty;

  if (startX === 0 && startY === 0) return;

  child.animate(
    {
      transform: `translate(${startX}px, ${startY}px)`,
      offset: 0,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );
}
