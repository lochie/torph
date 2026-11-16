import type { Segment } from "../../utils/types";

let canvas: HTMLCanvasElement | undefined;
// A pair's kerning in px, or null where the font substitutes a glyph for it.
const pairs = new Map<string, Map<string, number | null>>();
const MAX_FONTS = 32; // A fluid font size is a new font string on every resize.

/** The canvas font for a computed style. */
export function fontOf(style: CSSStyleDeclaration): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

export type Kerning = {
  font: string;
  fontSize: number;
  numerals: boolean;
  kern: boolean;
};

/** What kerning needs from the root's style, or null where a canvas can't stand in for it. */
export function readKerning(style: CSSStyleDeclaration): Kerning | null {
  const fontSize = parseFloat(style.fontSize);
  if (!fontSize) return null;
  // A canvas can't apply feature settings, so it would kern glyphs the page isn't drawing.
  if (style.fontFeatureSettings && style.fontFeatureSettings !== "normal")
    return null;
  return {
    font: fontOf(style),
    fontSize,
    numerals:
      !style.fontVariantNumeric || style.fontVariantNumeric === "normal",
    kern: style.fontKerning !== "none",
  };
}

const FIRST = /^\P{M}\p{M}*/u;
const LAST = /\P{M}\p{M}*$/u;

const SPACING = 10;

function pairWidth(ruler: CanvasRenderingContext2D, a: string, b: string) {
  return (
    ruler.measureText(a + b).width -
    ruler.measureText(a).width -
    ruler.measureText(b).width
  );
}

/**
 * A ligature or contextual alternate narrows a pair too, but separate boxes never
 * form one. Letter-spacing tells them apart: it drops the substitution (Chromium) or one
 * glyph's worth of spacing with it (WebKit, Firefox), and leaves kerning be.
 */
function measurePair(
  ruler: CanvasRenderingContext2D,
  a: string,
  b: string,
): number | null {
  const kern = pairWidth(ruler, a, b);
  // Unkerned pairs come back as float noise, not zero.
  if (Math.abs(kern) < 0.01) return 0;
  if (!("letterSpacing" in ruler)) return kern;
  ruler.letterSpacing = `${SPACING}px`;
  const spaced = pairWidth(ruler, a, b);
  // The canvas is shared with the ink ruler.
  ruler.letterSpacing = "0px";
  return Math.abs(spaced - kern) < 0.01 ? kern : null;
}

/** Measures a segment against the next — undefined where the two can't touch. */
function pairRuler(font: string) {
  canvas ??= document.createElement("canvas");
  const ruler = canvas.getContext("2d");
  if (!ruler) return null;
  ruler.font = font;

  let cache = pairs.get(font);
  if (!cache) {
    if (pairs.size >= MAX_FONTS) pairs.clear();
    pairs.set(font, (cache = new Map()));
  }
  const known = cache;

  return (a: Segment, b: Segment | undefined): number | null | undefined => {
    if (!b || a.string === "\n" || b.string === "\n") return undefined;
    const left = LAST.exec(a.string)?.[0]?.replace("\u00A0", " ");
    const right = FIRST.exec(b.string)?.[0]?.replace("\u00A0", " ");
    if (!left || !right) return undefined;
    const key = `${left}\n${right}`;
    let kern = known.get(key);
    if (kern === undefined) {
      kern = measurePair(ruler, left, right);
      known.set(key, kern);
    }
    return kern;
  };
}

/**
 * Each segment's kerning against the one after it on its line, in em, keyed by ID —
 * the adjustment a single text run applies and separate boxes lose.
 */
export function kernSegments(
  segments: Segment[],
  kerning: Kerning | null,
): Map<string, number> {
  const gaps = new Map<string, number>();
  if (!kerning?.kern || segments.length < 2) return gaps;
  const pair = pairRuler(kerning.font);
  if (!pair) return gaps;

  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i]!;
    const b = segments[i + 1]!;
    if (!kerning.numerals && (a.kind || b.kind)) continue;
    const kern = pair(a, b);
    if (kern) gaps.set(a.id, kern / kerning.fontSize);
  }

  return gaps;
}

let watching = false;

/** A web font landing keeps the font string but changes every pair. */
export function watchFonts(onLoad: () => void) {
  if (watching || typeof document === "undefined" || !document.fonts) return;
  watching = true;
  document.fonts.addEventListener("loadingdone", () => {
    pairs.clear();
    onLoad();
  });
}
