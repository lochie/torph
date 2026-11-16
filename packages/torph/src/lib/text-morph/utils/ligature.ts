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

export type Shaping = { font: string; ligatures: boolean; contextual: boolean };

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
    contextual: ligatures !== "none" && !ligatures.includes("no-contextual"),
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

const joined = (run: Segment[]): Segment => ({
  id: LIGATURE + run.map((s) => s.id).join("\u0000"),
  string: run.map((s) => s.string).join(""),
});

// Scripts shaped by their neighbours — joining, conjuncts, stacked marks — in swaps no width can see.
const SHAPED =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Hanifi_Rohingya}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Tibetan}]/u;

const shaped = (segment: Segment, side: RegExp) =>
  segment.string !== "\n" && SHAPED.test(side.exec(segment.string)?.[0] ?? "");

// What contextual alternates swap: punctuation and symbols, like a colon raised between digits.
const SYMBOL = /^[\p{P}\p{S}]$/u;
let ink: CanvasRenderingContext2D | null | undefined;
const triples = new Map<string, Map<string, boolean>>();

/** The rows a glyph's ink spans, or null for an empty canvas. */
function inkRows(g: CanvasRenderingContext2D, w: number, h: number) {
  const data = g.getImageData(0, 0, w, h).data;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! > 128) {
        if (top < 0) top = y;
        bottom = y;
      }
  return top < 0 ? null : `${top}-${bottom}`;
}

/**
 * Whether the font draws `mid` differently between `left` and `right`. A contextual
 * alternate can keep its width, so this compares ink: the three are drawn together,
 * the outer two erased by drawing them alone, and what's left set against `mid` alone.
 */
function swapsBetween(font: string, left: string, mid: string, right: string) {
  let known = triples.get(font);
  if (!known) {
    if (triples.size >= MAX_FONTS) triples.clear();
    triples.set(font, (known = new Map()));
  }
  const key = `${left}\n${mid}\n${right}`;
  const cached = known.get(key);
  if (cached !== undefined) return cached;
  if (ink === undefined)
    ink = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
  if (!ink) return false;
  const g = ink;
  g.font = font;
  const size = Math.ceil(g.measureText("M").width * 2) + 8;
  const w = Math.ceil(g.measureText(left + mid + right).width) + 16;
  g.canvas.width = Math.min(w, 2048);
  g.canvas.height = Math.min(size * 2, 512);
  g.font = font;
  const base = size + 4;
  const draw = (text: string, x: number, op: GlobalCompositeOperation) => {
    g.globalCompositeOperation = op;
    g.fillText(text, x, base);
  };
  const at = 8;
  const midAt = at + g.measureText(left + mid).width - g.measureText(mid).width;
  const rightAt =
    at + g.measureText(left + mid + right).width - g.measureText(right).width;
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  draw(left + mid + right, at, "source-over");
  draw(left, at, "destination-out");
  draw(right, rightAt, "destination-out");
  const together = inkRows(g, g.canvas.width, g.canvas.height);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  draw(mid, midAt, "source-over");
  const alone = inkRows(g, g.canvas.width, g.canvas.height);
  g.globalCompositeOperation = "source-over";
  const swaps = together !== alone;
  known.set(key, swaps);
  return swaps;
}

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
  // Shaped scripts need no font to know about, so they share a box from the first render.
  const pair = shaping?.ligatures ? pairRuler(shaping.font) : null;
  // One test of the whole value, so text with nothing to join skips the pair-by-pair check.
  const text = segments.map((s) => s.string).join("");
  const joining = SHAPED.test(text);
  const contextual =
    !!shaping?.contextual && /[\p{P}\p{S}]/u.test(text) ? shaping.font : null;
  if (!pair && !joining && !contextual) return segments;

  const after = segments.map((a, i) => {
    const b = segments[i + 1];
    if (!b) return false;
    if (joining && shaped(a, LAST) && shaped(b, FIRST)) return true;
    // A digit slides inside its own slot, so only a glyph it changes earns it a shared box.
    if (a.kind || b.kind) return false;
    return pair ? pair(a, b) : false;
  });
  if (contextual) {
    for (let i = 1; i < segments.length - 1; i++) {
      const [l, m, r] = [segments[i - 1]!, segments[i]!, segments[i + 1]!];
      if (!SYMBOL.test(m.string) || l.string === "\n" || r.string === "\n")
        continue;
      const left = LAST.exec(l.string)?.[0];
      const right = FIRST.exec(r.string)?.[0];
      if (!left || !right) continue;
      if (swapsBetween(contextual, left, m.string, right))
        after[i - 1] = after[i] = true;
    }
  }

  const out: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = i;
    while (after[i]) i++;
    out.push(i === start ? segments[i]! : joined(segments.slice(start, i + 1)));
  }
  return out.length === segments.length ? segments : out;
}

// A space's ID comes from its offset, so it shifts whenever a line above changes length.
const isSpace = (s: Segment) => s.string === "\u00A0";

/** What a line draws, and the words that draw it — the same key on both sides is a line that didn't change. */
export function lineKey(line: Segment[]): string {
  return [
    line.map((s) => s.string).join(""),
    ...line.filter((s) => !isSpace(s)).map((s) => s.id),
  ].join("\u0000");
}

export type Runs = {
  before: [number, number][];
  after: [number, number][];
  keys: string[];
};

/**
 * Every stretch of segments that keeps its order and its text from one value to the
 * next, on both sides, within a line and starting and ending on a word. Spaces count
 * as kept wherever they stand between kept words, whatever their offset IDs became.
 */
export function stableRuns(before: Segment[], after: Segment[]): Runs {
  const at = new Map(before.map((s, i) => [s.id, i]));
  const runs: Runs = { before: [], after: [], keys: [] };
  const same = (x: Segment, y: Segment) =>
    x.string !== "\n" &&
    y.string !== "\n" &&
    ((isSpace(x) && isSpace(y)) || (x.id === y.id && x.string === y.string));
  for (let i = 0; i < after.length; ) {
    const o = at.get(after[i]!.id);
    if (o === undefined || isSpace(after[i]!) || !same(after[i]!, before[o]!)) {
      i++;
      continue;
    }
    let a = i;
    let b = o;
    while (
      a + 1 < after.length &&
      b + 1 < before.length &&
      same(after[a + 1]!, before[b + 1]!)
    ) {
      a++;
      b++;
    }
    while (a > i && isSpace(after[a]!)) {
      a--;
      b--;
    }
    if (a > i) {
      runs.after.push([i, a]);
      runs.before.push([o, b]);
      runs.keys.push(lineKey(after.slice(i, a + 1)));
    }
    i = a + 1;
  }
  return runs;
}

/**
 * Mid-morph, the runs already drawn whole that the new value still holds intact —
 * where each one now sits. Recomputing runs instead could extend one and swap its box.
 */
export function intactRuns(
  whole: Segment[][],
  after: Segment[],
): [number, number][] {
  const at = new Map(after.map((s, i) => [s.id, i]));
  const ranges: [number, number][] = [];
  for (const run of whole) {
    const start = at.get(run[0]!.id);
    if (start === undefined) continue;
    const intact = run.every((part, k) => {
      const now = after[start + k];
      return (
        !!now &&
        now.string === part.string &&
        (isSpace(part) || now.id === part.id)
      );
    });
    if (intact) ranges.push([start, start + run.length - 1]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * Joins each run a morph leaves alone into one segment, so it is drawn as one run of
 * text and moves as one box: a morph splits only what it touches. Same IDs as a
 * ligature — built from the parts', spaces aside — so a run keeps its box across morphs.
 */
export function joinRuns(
  segments: Segment[],
  ranges: [number, number][],
): { segments: Segment[]; parts: Map<string, Segment[]> } {
  const parts = new Map<string, Segment[]>();
  if (ranges.length === 0) return { segments, parts };
  const starts = new Map(ranges);
  const out: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const end = starts.get(i);
    if (end === undefined) {
      out.push(segments[i]!);
      continue;
    }
    const run = segments.slice(i, end + 1);
    const whole = {
      ...joined(run.filter((s) => !isSpace(s))),
      string: run.map((s) => s.string).join(""),
    };
    parts.set(whole.id, run);
    out.push(whole);
    i = end;
  }
  return { segments: out, parts };
}
