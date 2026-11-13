import { readAnimationState, cancelAnimations } from "../../utils/animate";
import type { AnimationState } from "../../utils/animate";
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
    previous?: AnimationState;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, duration, ease } = options;

  const { tx, ty } = options.previous ?? readAnimationState(slot);
  slot.getAnimations().forEach((a) => a.cancel());

  const startX = deltaX + tx;
  const startY = deltaY + ty;

  if (startX === 0 && startY === 0) return;

  slot.animate(
    { transform: `translate(${startX}px, ${startY}px)`, offset: 0 },
    { duration, easing: ease, fill: "both" },
  );
}

// Every character a slot can hold that reaches far: digits, separators, common affixes.
const INK = "0123456789$€£¥%,.";
let canvas: HTMLCanvasElement | undefined;

function lengthOf(value: string, fontSize: number, fallback: number): number {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return value.trim().endsWith("em") ? n * fontSize : n;
}

/**
 * How far a slot's clip must reach past each side of a line so a settled digit's
 * ink, plus the fade band, sits inside it. Zero wherever the line is tall enough.
 */
export function slotOverflow(root: HTMLElement): {
  top: number;
  bottom: number;
} {
  canvas ??= document.createElement("canvas");
  const ruler = canvas.getContext("2d");
  if (!ruler) return { top: 0, bottom: 0 };
  const style = getComputedStyle(root);
  ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const ink = ruler.measureText(INK);
  const ascent = ink.fontBoundingBoxAscent;
  const descent = ink.fontBoundingBoxDescent;
  if (!ascent && !descent) return { top: 0, bottom: 0 };

  const fontSize = parseFloat(style.fontSize) || 0;
  const fade = lengthOf(
    style.getPropertyValue("--torph-fade"),
    fontSize,
    0.15 * fontSize,
  );
  const lineHeight =
    style.lineHeight === "normal"
      ? ascent + descent
      : parseFloat(style.lineHeight);
  // The content area sits centred in the line box; leading may be negative.
  const leading = (lineHeight - ascent - descent) / 2;
  return {
    top: Math.max(0, fade - (leading + ascent - ink.actualBoundingBoxAscent)),
    bottom: Math.max(
      0,
      fade - (leading + descent - ink.actualBoundingBoxDescent),
    ),
  };
}
