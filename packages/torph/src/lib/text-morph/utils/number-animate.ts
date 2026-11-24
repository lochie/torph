import {
  ARRIVE,
  readAnimationState,
  cancelAll,
  cancelAnimations,
} from "../../utils/animate";
import type { MotionContext } from "../plugin";

// Shares of the morph, not fixed lengths. The outgoing share is larger because a
// digit that has already left is a hole in the number.
const EXIT_FADE = 0.45;
const ENTER_FADE = 0.25;

// A digit has to clear the whole mask, which can outgrow a tight line.
const slide = ({ line }: MotionContext<unknown>) => line.clear;

/**
 * The slot takes the FLIP correction, the character inside it takes the slide and
 * fade. Keeping the slide off the slot is what lets a digit cross a whole line box
 * without the next morph measuring it as moved.
 */
export function animateNumberExit(
  slot: HTMLElement,
  ctx: MotionContext<unknown>,
) {
  const { delta, mover, duration, ease } = ctx;

  slot.animate(
    { transform: `translate(${delta.x}px, ${delta.y}px)`, offset: 1 },
    { duration, easing: ease, fill: "both" },
  );

  mover.animate(
    { transform: `translate(0px, ${slide(ctx)}px)`, offset: 1 },
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
  ctx: MotionContext<unknown>,
) {
  const { mover, kind, duration, ease } = ctx;

  animateNumberPersist(slot, ctx);

  const prev = cancelAnimations(mover, ctx.moverFrom);

  // Digits arrive from above, separators from below, so each reads as its own event.
  const from = kind === "digit" ? -slide(ctx) : slide(ctx);

  mover.animate(
    { transform: `translate(0px, ${prev.ty + from}px)`, offset: 0 },
    { duration, easing: ease, fill: ARRIVE },
  );

  const startOpacity = prev.opacity >= 1 ? 0 : prev.opacity;
  if (startOpacity < 1) {
    mover.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: duration * ENTER_FADE,
      easing: "linear",
      fill: ARRIVE,
    });
  }
}

export function animateNumberPersist(
  slot: HTMLElement,
  ctx: MotionContext<unknown>,
) {
  const { delta, duration, ease } = ctx;

  const { tx, ty } = ctx.from ?? readAnimationState(slot);
  cancelAll(slot);

  const startX = delta.x + tx;
  const startY = delta.y + ty;

  if (startX === 0 && startY === 0) return;

  slot.animate(
    { transform: `translate(${startX}px, ${startY}px)`, offset: 0 },
    { duration, easing: ease, fill: ARRIVE },
  );
}
