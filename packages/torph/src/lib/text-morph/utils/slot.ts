// The mask every slot draws: how far its glyphs reach, so the stylesheet can grow the clip to fit.
import { fontOf } from "./ligature";

/** What a slot holds unless its kind says otherwise: digits, separators, common affixes. */
export const DIGIT_INK = "0123456789$€£¥%,.";
let canvas: HTMLCanvasElement | undefined;

type Ink = { ascent: number; descent: number; top: number; bottom: number };
const inks = new Map<string, Ink>();
let watchingFonts = false;

/** The font's content area and the ink of `glyphs`, measured once per font. */
function measureInk(font: string, glyphs: string): Ink | null {
  const key = `${font}\u0000${glyphs}`;
  const cached = inks.get(key);
  if (cached) return cached;
  canvas ??= document.createElement("canvas");
  const ruler = canvas.getContext("2d");
  if (!ruler) return null;
  ruler.font = font;
  const m = ruler.measureText(glyphs);
  if (!m.fontBoundingBoxAscent && !m.fontBoundingBoxDescent) return null;
  const ink = {
    ascent: m.fontBoundingBoxAscent,
    descent: m.fontBoundingBoxDescent,
    top: m.actualBoundingBoxAscent,
    bottom: m.actualBoundingBoxDescent,
  };
  inks.set(key, ink);
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
export function slotClip(style: CSSStyleDeclaration, glyphs: string): SlotClip {
  const ink = measureInk(fontOf(style), glyphs);
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
