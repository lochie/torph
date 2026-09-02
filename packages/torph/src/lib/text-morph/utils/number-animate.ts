import { parseTranslate, cancelAnimations } from "../../utils/animate";
import { moverOf } from "../../utils/dom";

// Shares of the morph, not fixed lengths. The outgoing share is larger because a
// digit that has already left is a hole in the number.
const EXIT_FADE = 0.45;
const ENTER_FADE = 0.25;

/**
 * The slot takes the FLIP correction, the character inside it takes the slide and
 * fade. Keeping the slide off the slot is what lets a digit cross a whole line box
 * without the next morph measuring it as moved.
 */
export function animateNumberExit(
  slot: HTMLElement,
  options: {
    dx: number;
    dy: number;
    slideDistance: number;
    duration: number;
    ease: string;
  },
) {
  const { dx, dy, slideDistance, duration, ease } = options;
  const mover = moverOf(slot);

  slot.animate(
    { transform: `translate(${dx}px, ${dy}px)`, offset: 1 },
    { duration, easing: ease, fill: "both" },
  );

  mover.animate(
    { transform: `translate(0px, ${slideDistance}px)`, offset: 1 },
    { duration, easing: ease, fill: "both" },
  );

  const fadeAnimation = mover.animate(
    { opacity: 0, offset: 1 },
    { duration: duration * EXIT_FADE, easing: "linear", fill: "both" },
  );

  // The slot goes, not just its contents.
  fadeAnimation.onfinish = () => slot.remove();
}

export function animateNumberEnter(
  slot: HTMLElement,
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

  animateNumberPersist(slot, { deltaX, deltaY, duration, ease });

  const mover = moverOf(slot);
  const prev = cancelAnimations(mover);

  // Digits arrive from above, separators from below, so each reads as its own event.
  const from = kind === "digit" ? -slideDistance : slideDistance;

  mover.animate(
    { transform: `translate(0px, ${prev.ty + from}px)`, offset: 0 },
    { duration, easing: ease, fill: "both" },
  );

  const startOpacity = prev.opacity >= 1 ? 0 : prev.opacity;
  if (startOpacity < 1) {
    mover.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: duration * ENTER_FADE,
      easing: "linear",
      fill: "both",
    });
  }
}

export function animateNumberPersist(
  slot: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, duration, ease } = options;

  const { tx, ty } = parseTranslate(slot);
  slot.getAnimations().forEach((a) => a.cancel());

  const startX = deltaX + tx;
  const startY = deltaY + ty;

  if (startX === 0 && startY === 0) return;

  slot.animate(
    { transform: `translate(${startX}px, ${startY}px)`, offset: 0 },
    { duration, easing: ease, fill: "both" },
  );
}
