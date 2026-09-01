import { parseTranslate, cancelAnimations } from "../../utils/animate";
import { moverOf } from "../../utils/dom";

/**
 * Fades are a share of the morph rather than a fixed length, and the outgoing
 * share is the larger one: a digit that has already left is a hole in the
 * number, so it stays legible well into the slide, while the incoming digit
 * asserts itself early instead of ghosting in behind it.
 *
 * The slot's mask is doing most of the work here — both sets of characters are
 * also being clipped as they cross their line box — so these only have to
 * soften the edges of that.
 */
const EXIT_FADE = 0.45;
const ENTER_FADE = 0.25;

/**
 * Every one of these splits the same way. The slot takes the FLIP correction,
 * because that is what layout moved and what the next morph will measure; the
 * character inside it takes the slide and the fade, because that is what has to
 * happen behind a clip. Keeping the slide off the slot is what lets a digit
 * travel a whole line box without the diff ever seeing it move.
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

  // Removal is the fade finishing, so the share above is also how long an
  // exiting character stays in the DOM. The slot goes, not just its contents.
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

  // Digits arrive from above and the symbols between them from below, so a
  // separator appearing mid-number reads as its own event rather than as one
  // more digit.
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
