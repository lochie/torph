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

type Ink = { ascent: number; descent: number; top: number; bottom: number };
const inks = new Map<string, Ink>();
let watchingFonts = false;

/** The font's content area and its digits' ink, measured once per font. */
function measureInk(font: string): Ink | null {
  const cached = inks.get(font);
  if (cached) return cached;
  canvas ??= document.createElement("canvas");
  const ruler = canvas.getContext("2d");
  if (!ruler) return null;
  ruler.font = font;
  const m = ruler.measureText(INK);
  if (!m.fontBoundingBoxAscent && !m.fontBoundingBoxDescent) return null;
  const ink = {
    ascent: m.fontBoundingBoxAscent,
    descent: m.fontBoundingBoxDescent,
    top: m.actualBoundingBoxAscent,
    bottom: m.actualBoundingBoxDescent,
  };
  inks.set(font, ink);
  // A web font landing keeps the font string but changes every metric.
  if (!watchingFonts && document.fonts) {
    watchingFonts = true;
    document.fonts.addEventListener("loadingdone", () => inks.clear());
  }
  return ink;
}

function lengthOf(value: string, fontSize: number, fallback: number): number {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return value.trim().endsWith("em") ? n * fontSize : n;
}

export type SlotClip = {
  /** The ink's reach from the line's centre, in em — what the stylesheet reads. */
  inkTop: number | null;
  inkBottom: number | null;
  /** How far the stylesheet will grow the clip past the line, in px. */
  top: number;
  bottom: number;
};

export const NO_CLIP: SlotClip = {
  inkTop: null,
  inkBottom: null,
  top: 0,
  bottom: 0,
};

// Asked once a measurement exists to apply them to; neither answer changes.
let supportsLh: boolean | undefined;
let supportsRound: boolean | undefined;

/**
 * The slot clip the stylesheet will draw for this font and line-height, so the
 * slide can clear it. Mirrors the slot rule in styles.ts; with no measurement it
 * falls back to no overflow, the one case the stylesheet can't be followed.
 */
export function slotClip(style: CSSStyleDeclaration): SlotClip {
  const ink = measureInk(
    `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
  );
  const fontSize = parseFloat(style.fontSize);
  if (!ink || !fontSize) return NO_CLIP;
  supportsLh ??= CSS.supports("height: 1lh");
  if (!supportsLh) return NO_CLIP;

  const fade = lengthOf(
    style.getPropertyValue("--torph-fade"),
    fontSize,
    0.15 * fontSize,
  );
  const lineHeight =
    style.lineHeight === "normal"
      ? ink.ascent + ink.descent
      : parseFloat(style.lineHeight);
  // The content area is centred in the line box, so its centre sits (ascent - descent) / 2 above the baseline.
  const centre = (ink.ascent - ink.descent) / 2;
  const inkTop = ink.top - centre;
  const inkBottom = ink.bottom + centre;
  supportsRound ??= CSS.supports("width: round(up, 1.5px, 1px)");
  const round = supportsRound ? Math.ceil : (n: number) => n;
  const past = (reach: number) =>
    round(Math.max(0, fade + reach - lineHeight / 2));
  return {
    inkTop: inkTop / fontSize,
    inkBottom: inkBottom / fontSize,
    top: past(inkTop),
    bottom: past(inkBottom),
  };
}
