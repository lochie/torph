/**
 * Canvas-based text measurement.
 *
 * Measures string widths via an OffscreenCanvas (or DOM canvas fallback)
 * instead of the DOM, so we can predict the container's target width without
 * triggering synchronous layout. Inspired by pretext's measurement module
 * (https://github.com/chenglou/pretext/blob/main/src/measurement.ts).
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let ctx: Ctx | null | undefined;

function getCtx(): Ctx | null {
  if (ctx !== undefined) return ctx;
  if (typeof OffscreenCanvas !== "undefined") {
    ctx = new OffscreenCanvas(1, 1).getContext("2d") as Ctx | null;
  } else if (typeof document !== "undefined") {
    ctx = document.createElement("canvas").getContext("2d");
  } else {
    ctx = null;
  }
  return ctx;
}

export type FontMetrics = {
  font: string;
  letterSpacing: string;
  wordSpacing: string;
};

/**
 * Build the canvas `font` shorthand from an element's computed style.
 *
 * `getComputedStyle(el).font` returns an empty string in most browsers unless
 * the shorthand was set directly, so we assemble it from the constituent
 * properties. Also captures letter-/word-spacing since those apply to
 * `CanvasRenderingContext2D` directly.
 */
export function resolveFontMetrics(element: HTMLElement): FontMetrics {
  const cs = getComputedStyle(element);
  const style = cs.fontStyle || "normal";
  const variant = cs.fontVariant || "normal";
  const weight = cs.fontWeight || "400";
  const size = cs.fontSize || "16px";
  const family = cs.fontFamily || "sans-serif";
  // Canvas letterSpacing/wordSpacing expect a <length>, not "normal".
  const letterSpacing =
    cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  const wordSpacing = cs.wordSpacing === "normal" ? "0px" : cs.wordSpacing;
  return {
    font: `${style} ${variant} ${weight} ${size} ${family}`,
    letterSpacing,
    wordSpacing,
  };
}

// font|letterSpacing|wordSpacing -> (text -> width)
const cache = new Map<string, Map<string, number>>();

function cacheFor(metrics: FontMetrics): Map<string, number> {
  const key = `${metrics.font}|${metrics.letterSpacing}|${metrics.wordSpacing}`;
  let inner = cache.get(key);
  if (!inner) {
    inner = new Map();
    cache.set(key, inner);
  }
  return inner;
}

/** Measure the advance width of `text` at the given font metrics. */
export function measureText(text: string, metrics: FontMetrics): number {
  const inner = cacheFor(metrics);
  const cached = inner.get(text);
  if (cached !== undefined) return cached;

  const c = getCtx();
  if (!c) return 0;

  c.font = metrics.font;
  // letterSpacing/wordSpacing on canvas are newer (Chromium/Safari TP);
  // older browsers silently ignore the assignment.
  (c as unknown as { letterSpacing?: string }).letterSpacing =
    metrics.letterSpacing;
  (c as unknown as { wordSpacing?: string }).wordSpacing = metrics.wordSpacing;

  const width = c.measureText(text).width;
  inner.set(text, width);
  return width;
}

/**
 * Sum the advance widths of a list of strings (e.g. torph segments rendered
 * as adjacent inline-block spans). Each string is measured independently so
 * the total matches the DOM layout, which does not apply kerning across
 * inline-block boundaries.
 */
export function measureSegmentsWidth(
  strings: readonly string[],
  metrics: FontMetrics,
): number {
  let total = 0;
  for (const s of strings) {
    total += measureText(s, metrics);
  }
  return total;
}
