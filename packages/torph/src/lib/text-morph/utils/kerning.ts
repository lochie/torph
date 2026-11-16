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
  ligatures: boolean;
};

/** What shaping needs from the root's style, or null where a canvas can't stand in for it. */
export function readKerning(style: CSSStyleDeclaration): Kerning | null {
  const fontSize = parseFloat(style.fontSize);
  if (!fontSize) return null;
  // A canvas can't apply feature settings, so it would shape glyphs the page isn't drawing.
  if (style.fontFeatureSettings && style.fontFeatureSettings !== "normal")
    return null;
  const ligatures = style.fontVariantLigatures || "normal";
  return {
    font: fontOf(style),
    fontSize,
    numerals:
      !style.fontVariantNumeric || style.fontVariantNumeric === "normal",
    kern: style.fontKerning !== "none",
    ligatures:
      ligatures !== "none" &&
      !(
        ligatures.includes("no-common-ligatures") &&
        ligatures.includes("no-contextual")
      ),
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
 * A ligature or contextual alternate narrows a pair too, but only one box can form
 * it. Letter-spacing tells them apart: it drops the substitution (Chromium) or one
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

const LIGATURE = "\u0000l"; // NUL never occurs in text, and `l` keeps it off a number's `\u0000n`.

const edge = (segment: Segment, side: RegExp) =>
  segment.id.startsWith(LIGATURE)
    ? segment.string
    : side.exec(segment.string)?.[0];

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
    // A ligature's neighbour meets the joined glyph, not the letter it started as.
    const left = edge(a, LAST)?.replace("\u00A0", " ");
    const right = edge(b, FIRST)?.replace("\u00A0", " ");
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

// Joining scripts shape every letter by its neighbours — a one-for-one swap no measurement can see.
const CURSIVE =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Hanifi_Rohingya}]/u;

const cursive = (segment: Segment, side: RegExp) =>
  segment.string !== "\n" && CURSIVE.test(side.exec(segment.string)?.[0] ?? "");

/**
 * Joins every run of segments the font draws as one glyph into a single segment,
 * since separate boxes can't form it. The ID is built from the parts', so the same
 * parts keep the same box from one morph to the next.
 */
export function ligate(
  segments: Segment[],
  kerning: Kerning | null,
): Segment[] {
  if (segments.length < 2) return segments;
  // Joining letters need no font to know about, so they share a box from the first render.
  const pair = kerning?.ligatures ? pairRuler(kerning.font) : null;

  // A digit slides inside its own slot, so it never shares a box.
  const joins = (i: number) => {
    const a = segments[i]!;
    const b = segments[i + 1];
    if (!b || a.kind || b.kind) return false;
    if (cursive(a, LAST) && cursive(b, FIRST)) return true;
    return pair?.(a, b) === null;
  };

  const out: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = i;
    while (joins(i)) i++;
    if (i === start) {
      out.push(segments[i]!);
      continue;
    }
    const run = segments.slice(start, i + 1);
    out.push({
      id: LIGATURE + run.map((s) => s.id).join("\u0000"),
      string: run.map((s) => s.string).join(""),
    });
  }
  return out.length === segments.length ? segments : out;
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
