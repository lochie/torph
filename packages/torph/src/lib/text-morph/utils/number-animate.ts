import { readAnimationState, cancelAnimations } from "../../utils/animate";
import type { AnimationState } from "../../utils/animate";
import { moverOf } from "../../utils/dom";
import { ATTR_SLIDING } from "../../utils/constants";

const slides = new WeakMap<HTMLElement, Animation>();
const reveals = new WeakMap<HTMLElement, Animation>();

// Past a glyph's overflow at line-height 0.5 plus the fade band, so the edges clear it.
const REVEAL = "0.75em";
const SHUT: Keyframe = {
  clipPath: "inset(0px -100vw)",
  maskSize: "100% 100%",
  maskPosition: "0px 0px",
};
const OPEN: Keyframe = {
  clipPath: `inset(-${REVEAL} -100vw)`,
  maskSize: `100% calc(100% + 2 * ${REVEAL})`,
  maskPosition: `0px -${REVEAL}`,
};

/**
 * Clips the slot for the length of a slide, widening the clip and fade off the
 * glyph as the digit lands (or onto it as it leaves) so neither end pops.
 */
function trackSlide(
  slot: HTMLElement,
  slide: Animation,
  arriving: boolean,
  timing: { duration: number; ease: string },
) {
  slot.setAttribute(ATTR_SLIDING, "");
  slides.set(slot, slide);
  reveals.get(slot)?.cancel();
  reveals.set(
    slot,
    slot.animate(arriving ? [SHUT, OPEN] : [OPEN, SHUT], {
      duration: timing.duration,
      easing: timing.ease,
      fill: "both",
    }),
  );
  const settle = () => {
    if (slides.get(slot) !== slide) return;
    slides.delete(slot);
    reveals.get(slot)?.cancel();
    reveals.delete(slot);
    slot.removeAttribute(ATTR_SLIDING);
  };
  slide.addEventListener("finish", settle);
  slide.addEventListener("cancel", settle);
}

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

  trackSlide(
    slot,
    mover.animate(
      { transform: `translate(0px, ${slideDistance}px)`, offset: 1 },
      { duration, easing: ease, fill: "both" },
    ),
    false,
    { duration, ease },
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
    previous?: AnimationState;
    moverPrevious?: AnimationState;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, slideDistance, kind, duration, ease } = options;

  animateNumberPersist(slot, {
    deltaX,
    deltaY,
    duration,
    ease,
    previous: options.previous,
  });

  const mover = moverOf(slot);
  const prev = cancelAnimations(mover, options.moverPrevious);

  // Digits arrive from above, separators from below, so each reads as its own event.
  const from = kind === "digit" ? -slideDistance : slideDistance;

  trackSlide(
    slot,
    mover.animate(
      { transform: `translate(0px, ${prev.ty + from}px)`, offset: 0 },
      { duration, easing: ease, fill: "both" },
    ),
    true,
    { duration, ease },
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
    previous?: AnimationState;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, duration, ease } = options;

  const { tx, ty } = options.previous ?? readAnimationState(slot);
  // The reveal belongs to the slide inside, which a re-placement leaves running.
  slot.getAnimations().forEach((a) => a !== reveals.get(slot) && a.cancel());

  const startX = deltaX + tx;
  const startY = deltaY + ty;

  if (startX === 0 && startY === 0) return;

  slot.animate(
    { transform: `translate(${startX}px, ${startY}px)`, offset: 0 },
    { duration, easing: ease, fill: "both" },
  );
}
