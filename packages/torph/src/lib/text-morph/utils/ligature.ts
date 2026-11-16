import type { Segment } from "../../utils/types";

let canvas: HTMLCanvasElement | undefined;
// Whether the font draws a pair as one glyph, per font string.
const pairs = new Map<string, Map<string, boolean>>();
const MAX_FONTS = 32; // A fluid font size is a new font string on every resize.
let watching = false;

/** The canvas font for a computed style. */
export function fontOf(style: CSSStyleDeclaration): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

export type Shaping = { font: string; ligatures: boolean };

/** What ligature detection needs from the root's style, or null where a canvas can't stand in for it. */
export function readShaping(style: CSSStyleDeclaration): Shaping | null {
  if (!parseFloat(style.fontSize)) return null;
  // A canvas can't apply feature settings, so it would shape glyphs the page isn't drawing.
  if (style.fontFeatureSettings && style.fontFeatureSettings !== "normal")
    return null;
  const ligatures = style.fontVariantLigatures || "normal";
  return {
    font: fontOf(style),
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
 * A ligature or contextual alternate narrows a pair, but so does kerning. Letter-spacing
 * tells them apart: it drops the substitution (Chromium) or one glyph's worth of spacing
 * with it (WebKit, Firefox), and leaves kerning be.
 */
function substitutes(ruler: CanvasRenderingContext2D, a: string, b: string) {
  const plain = pairWidth(ruler, a, b);
  // Unkerned pairs come back as float noise, not zero.
  if (Math.abs(plain) < 0.01 || !("letterSpacing" in ruler)) return false;
  ruler.letterSpacing = `${SPACING}px`;
  const spaced = pairWidth(ruler, a, b);
  // The canvas is shared with the ink ruler.
  ruler.letterSpacing = "0px";
  return Math.abs(spaced - plain) >= 0.01;
}

/** Whether a segment and the next are drawn as one glyph — false where the two can't touch. */
function pairRuler(font: string) {
  canvas ??= document.createElement("canvas");
  const ruler = canvas.getContext("2d");
  if (!ruler) return null;
  ruler.font = font;

  // A web font landing keeps the font string but changes every pair.
  if (!watching && typeof document !== "undefined" && document.fonts) {
    watching = true;
    document.fonts.addEventListener("loadingdone", () => pairs.clear());
  }
  let cache = pairs.get(font);
  if (!cache) {
    if (pairs.size >= MAX_FONTS) pairs.clear();
    pairs.set(font, (cache = new Map()));
  }
  const known = cache;

  return (a: Segment, b: Segment | undefined): boolean => {
    if (!b || a.string === "\n" || b.string === "\n") return false;
    const left = LAST.exec(a.string)?.[0]?.replace(" ", " ");
    const right = FIRST.exec(b.string)?.[0]?.replace(" ", " ");
    if (!left || !right) return false;
    const key = `${left}\n${right}`;
    let joined = known.get(key);
    if (joined === undefined) {
      joined = substitutes(ruler, left, right);
      known.set(key, joined);
    }
    return joined;
  };
}

const LIGATURE = "\u0000l"; // NUL never occurs in text, and `l` keeps it off a number's `\u0000n`.

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
  shaping: Shaping | null,
): Segment[] {
  if (segments.length < 2) return segments;
  // Joining letters need no font to know about, so they share a box from the first render.
  const pair = shaping?.ligatures ? pairRuler(shaping.font) : null;
  // One test of the whole value, so text with no joining letters skips the pair-by-pair check.
  const joining = CURSIVE.test(segments.map((s) => s.string).join(""));
  if (!pair && !joining) return segments;

  // A digit slides inside its own slot, so it never shares a box.
  const joins = (i: number) => {
    const a = segments[i]!;
    const b = segments[i + 1];
    if (!b || a.kind || b.kind) return false;
    if (joining && cursive(a, LAST) && cursive(b, FIRST)) return true;
    return pair ? pair(a, b) : false;
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
