import type { TextMorphOptions } from "./types";
import { BASE_DEFAULTS, type Segment } from "../utils/types";
import { resolveEase } from "../utils/spring";
import { createIdAllocator, segmentText } from "./utils/segment";
import {
  type Frame,
  type Measures,
  type Placed,
  measure,
  measureBoxes,
  placer,
  computeDelta,
  findNearestAnchor,
  resolveExitingAnchors,
} from "../utils/flip";
import {
  clearContainerTransition,
  holdContainerSize,
  isContainerSettling,
  layoutSize,
  readAnimationState,
  cancelAnimations,
  animationsOf,
  holdAnimations,
  releaseAnimations,
  releaseContainerSize,
  resizeContainer,
  snapshotAnimations,
  animateFrom,
  type Where,
  trackAnimation,
  transitionContainerSize,
  type AnimationState,
} from "../utils/animate";
import { animateEnterOrPersist } from "./utils/animate";
import {
  type AnyPlugin,
  type HookSet,
  type Hooks,
  type Motion,
  type MotionContext,
  type RunContext,
  kindOwners,
  pluginIds,
} from "./plugin";
import { CLASSIC } from "./plugins";
import { DIGIT_INK, NO_CLIP, slotClip } from "./utils/slot";
import {
  placeDetached,
  readDetached,
  splitWordSpans,
  reconcileChildren,
  moverOf,
} from "../utils/dom";
import { replacedRuns } from "./utils/replace-animate";
import { diffSegments } from "./utils/diff";
import {
  type Shaping,
  fontOf,
  intactRuns,
  joinRuns,
  ligate,
  readShaping,
  stableRuns,
} from "./utils/ligature";
import { addStyles, removeStyles } from "../utils/styles";
import {
  ATTR_ROOT,
  ATTR_DEBUG,
  ATTR_EXITING,
  ATTR_LINGER,
  ATTR_ID,
  ATTR_KIND,
  VAR_INK_BOTTOM,
  VAR_INK_TOP,
  ATTR_SR,
  ATTR_TEXT,
  EMPTY_ID,
  DEBUG_GUARD,
} from "../utils/constants";
import {
  type ReducedMotionState,
  createReducedMotionListener,
} from "../utils/reduced-motion";

export type { TextMorphOptions } from "./types";
export type { SpringParams } from "../utils/spring";
export { MorphController } from "./controller";

export const DEFAULT_AS = "span";

const STRONG = /\p{L}/u;
const RTL =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}]/u;

/** The first strong letter's direction, as `dir="auto"` finds it — which rescans on every child the root gains. */
function directionOf(value: string): "rtl" | "ltr" {
  const first = STRONG.exec(value)?.[0];
  return first && RTL.test(first) ? "rtl" : "ltr";
}

/** Each arriving box and the leaving one in the same gap between unchanged boxes, i-th to i-th, both ways. */
function replacements(
  before: HTMLElement[],
  leaving: Set<HTMLElement>,
  after: HTMLElement[],
  arriving: Set<HTMLElement>,
) {
  const gaps = (order: HTMLElement[], moving: Set<HTMLElement>) => {
    const byGap = new Map<string, HTMLElement[]>();
    let gap = "";
    for (const box of order) {
      if (!moving.has(box)) gap = box.getAttribute(ATTR_ID)!;
      else if (byGap.has(gap)) byGap.get(gap)!.push(box);
      else byGap.set(gap, [box]);
    }
    return byGap;
  };
  const was = gaps(before, leaving);
  const pairs = new Map<HTMLElement, HTMLElement>();
  for (const [gap, boxes] of gaps(after, arriving)) {
    boxes.forEach((box, i) => {
      const old = was.get(gap)?.[i];
      if (old) pairs.set(box, old).set(old, box);
    });
  }
  return pairs;
}

/** Every glyph the slots of these plugins can hold, or null if none has a slot. */
function slotInk(plugins: readonly AnyPlugin[]) {
  const glyphs = plugins.flatMap((plugin) =>
    [...Object.values(plugin.kinds ?? {}), plugin.animate?.text ?? {}]
      .filter((spec) => spec.slot)
      .map((spec) => spec.ink ?? DIGIT_INK),
  );
  return glyphs.length ? [...new Set(glyphs.join(""))].join("") : null;
}

// An unchanged write would still restyle every slot.
function setStyleVar(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value)
    element.style.setProperty(name, value);
}

/** What every hook in one morph shares. */
type Scene = {
  states: Map<AnyPlugin, unknown>;
  line: { height: number; clear: number };
  arriving: number;
  leaving: number;
  pairs: Map<HTMLElement, HTMLElement>;
  animate: (
    element: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: KeyframeAnimationOptions,
    shift?: { x: number; y: number },
  ) => Animation;
  // The previous morph's text per box, before the reconcile rewrote any of it.
  was: Map<string, string>;
};

type Claimed = [AnyPlugin, HTMLElement[], DOMRect[]][];
export const DEFAULT_TEXT_MORPH_OPTIONS = {
  ...BASE_DEFAULTS,
  debug: false,
} as const satisfies Omit<TextMorphOptions, "element">;

const STILL = 0.1; // px — a box that moved less keeps its running animation rather than a new one, which is garbage on every update
const PROBE = 100; // px — a known layout length, to read an ancestor transform off the screen.

/** The value as text, one node per line — empty ones included, so a line index finds its node. */
function textOf(value: string): HTMLElement {
  const text = document.createElement("span");
  text.setAttribute(ATTR_TEXT, "");
  text.setAttribute("aria-hidden", "true");
  // Three points, origin and a step along each axis, so a rotation's direction survives.
  const probe = document.createElement("i");
  probe.style.cssText = "position: absolute; left: 0; top: 0";
  for (const [left, top] of [
    [PROBE, 0],
    [0, PROBE],
  ]) {
    const point = document.createElement("i");
    point.style.cssText = `position: absolute; left: ${left}px; top: ${top}px`;
    probe.append(point);
  }
  text.append(probe);
  // A zero-width space keeps an empty value's line box, as the boxes' stand-in does.
  (value || "\u200B").split("\n").forEach((line, i) => {
    if (i > 0) text.append(document.createElement("br"));
    text.append(document.createTextNode(line));
  });
  return text;
}

type Layout = {
  rects: (DOMRect | null)[];
  rtl: boolean;
  frame: Frame;
};

/** Where each segment sits in the text — null for a line break. */
function layoutOf(text: HTMLElement, segments: Segment[]): Layout {
  const probe = text.firstElementChild!;
  const origin = probe.getBoundingClientRect();
  const [x, y] = Array.from(probe.children, (point) => {
    const rect = point.getBoundingClientRect();
    return [(rect.left - origin.left) / PROBE, (rect.top - origin.top) / PROBE];
  });
  const frame: Frame = { a: x![0]!, b: x![1]!, c: y![0]!, d: y![1]! };
  const lines = Array.from(text.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  );
  const style = getComputedStyle(text);
  const rtl = style.direction === "rtl";
  const range = document.createRange();
  let line = 0;
  let offset = 0;
  // Per line, each segment's rect and its offsets in the line's text.
  const spans: { rect: DOMRect; line: number; from: number; to: number }[] = [];
  const rects = segments.map((segment) => {
    if (segment.string === "\n") {
      line++;
      offset = 0;
      return null;
    }
    const node = lines[line];
    const end = offset + segment.string.length;
    if (!node || end > node.length) return null;
    range.setStart(node, offset);
    range.setEnd(node, end);
    const rect = range.getBoundingClientRect();
    spans.push({ rect, line, from: offset, to: end });
    offset = end;
    return rect;
  });
  // WebKit places each segment a whole number of pixels from its line's start; its canvas has the fraction.
  const starts = new Map<number, DOMRect>();
  for (const span of spans)
    if (!starts.has(span.line)) starts.set(span.line, span.rect);
  const whole = spans.every(({ rect, line: n }) => {
    const start = starts.get(n)!;
    return Number.isInteger(
      rtl ? start.right - rect.right : rect.left - start.left,
    );
  });
  if (
    whole &&
    spans.length > starts.size &&
    Math.abs(frame.a - 1) < 1e-3 &&
    Math.abs(frame.b) < 1e-3
  ) {
    const fine = refine(lines, spans, style, rtl);
    if (fine) {
      let k = 0;
      for (let i = 0; i < rects.length; i++)
        if (rects[i]) rects[i] = fine[k++]!;
    }
  }
  return { rects, rtl, frame };
}

let ruler: CanvasRenderingContext2D | null | undefined;

/** Fractional rects for WebKit's whole-pixel ones, from a canvas where it agrees with the page. */
function refine(
  lines: Text[],
  spans: { rect: DOMRect; line: number; from: number; to: number }[],
  style: CSSStyleDeclaration,
  rtl: boolean,
): DOMRect[] | null {
  ruler ??= document.createElement("canvas").getContext("2d");
  if (!ruler) return null;
  ruler.font = fontOf(style);
  ruler.fontKerning = style.fontKerning as CanvasFontKerning;
  if ("letterSpacing" in ruler) ruler.letterSpacing = style.letterSpacing;
  if ("wordSpacing" in ruler) ruler.wordSpacing = style.wordSpacing;
  const width = (text: string) => ruler!.measureText(text).width;
  const out: DOMRect[] = [];
  for (let i = 0; i < spans.length; ) {
    const n = spans[i]!.line;
    const run = [];
    while (i < spans.length && spans[i]!.line === n) run.push(spans[i++]!);
    const data = lines[n]!.data;
    const first = run[0]!.rect;
    const last = run.at(-1)!.rect;
    const total = width(data.slice(run[0]!.from));
    // The canvas's fraction counts only inside WebKit's own pixel; past it, the pixel's middle.
    const starts = run.map((span, k) => {
      if (k === 0) return 0;
      const pixel = rtl
        ? first.right - span.rect.right
        : span.rect.left - first.left;
      const fine = total - width(data.slice(span.from)); // the whole less the rest keeps the kern across the edge
      return fine > pixel - 0.01 && fine < pixel + 1.01 ? fine : pixel + 0.5;
    });
    // The line's far edge is the one fractional edge WebKit reports.
    starts.push(rtl ? first.right - last.left : last.right - first.left);
    run.forEach((span, k) => {
      const start = starts[k]!;
      const end = starts[k + 1]!;
      out.push(
        rtl
          ? new DOMRect(
              first.right - end,
              span.rect.top,
              end - start,
              span.rect.height,
            )
          : new DOMRect(
              first.left + start,
              span.rect.top,
              end - start,
              span.rect.height,
            ),
      );
    });
  }
  return out;
}

/**
 * Sizes each box to the advance its segment has in the text — up to where the next one
 * starts, so the kerning between them comes with it and the boxes lay out as the text does.
 * Rects are on screen, so a transformed ancestor is taken back out first.
 */
function fitBoxes(boxes: HTMLElement[], { rects, frame, rtl }: Layout) {
  const place = placer(frame);
  // No layout (display: none), or turned 45°, where a bounding box no longer gives a width back.
  if (!place) return;
  let line: Placed | null = null;
  // Measured between leading edges: right to left, each segment starts on its right.
  const from = (at: Placed) =>
    rtl ? line!.x + line!.w - (at.x + at.w) : at.x - line!.x;
  boxes.forEach((box, i) => {
    const rect = rects[i];
    if (!rect || box.tagName === "BR") {
      line = null;
      return;
    }
    const here = place(rect);
    line ??= here;
    const next = rects[i + 1];
    const start = from(here);
    const end = next ? from(place(next)) : start + here.w;
    // Each edge snapped to the 1/64px layout unit, not each width: rounded widths add up along the line.
    const width = `${(Math.round(end * 64) - Math.round(start * 64)) / 64}px`;
    if (box.style.width !== width) box.style.width = width;
  });
}

type Letters = Map<string, Layout & { motion: Animation[]; width: number }>;

/** Where each letter sits inside a word box about to be split — the word's own kerning, read before it's gone. */
function lettersOf(
  element: HTMLElement,
  splits: Map<string, Segment[]>,
  frame: Frame,
): Letters {
  const out: Letters = new Map();
  if (splits.size === 0) return out;
  const rtl = getComputedStyle(element).direction === "rtl";
  const range = document.createRange();
  for (const word of Array.from(element.children) as HTMLElement[]) {
    const id = word.getAttribute(ATTR_ID);
    const letters = id && splits.get(id);
    const node = word.firstChild;
    if (!letters || !node || node.nodeType !== Node.TEXT_NODE) continue;
    const style = getComputedStyle(word);
    // A word caught mid-arrival is scaled; its letters' distances are scaled with it.
    const own =
      word.getBoundingClientRect().width /
      (Math.abs(frame.a) * parseFloat(style.width) +
        Math.abs(frame.c) * parseFloat(style.height));
    let offset = 0;
    const rects = letters.map((letter) => {
      range.setStart(node, offset);
      offset += letter.string.length;
      range.setEnd(node, offset);
      return range.getBoundingClientRect();
    });
    // Mid-morph, the box is on its way somewhere; its letters carry on from where it has got to.
    out.set(id, {
      rects,
      rtl,
      frame: {
        a: frame.a * own,
        b: frame.b * own,
        c: frame.c * own,
        d: frame.d * own,
      },
      motion: [...animationsOf(word)],
      width: parseFloat(word.style.width),
    });
  }
  return out;
}

function fitLetters(
  element: HTMLElement,
  splits: Map<string, Segment[]>,
  letters: Letters,
) {
  if (letters.size === 0) return;
  const byId = new Map(
    (Array.from(element.children) as HTMLElement[]).map((child) => [
      child.getAttribute(ATTR_ID),
      child,
    ]),
  );
  for (const [id, layout] of letters) {
    const boxes = splits
      .get(id)!
      .map((letter) => byId.get(letter.id))
      .filter((box): box is HTMLElement => !!box);
    if (boxes.length !== layout.rects.length) continue;
    fitBoxes(boxes, layout);
    // The last letter has no next to measure to; it ends where its word did, kerning into the next box included.
    const last = boxes[boxes.length - 1]!;
    const lead = boxes
      .slice(0, -1)
      .reduce((sum, box) => sum + parseFloat(box.style.width), 0);
    if (last.style.width && Number.isFinite(layout.width - lead))
      last.style.width = `${Math.round((layout.width - lead) * 64) / 64}px`;
    for (const box of boxes)
      for (const animation of layout.motion) {
        const effect = animation.effect as KeyframeEffect | null;
        if (!effect) continue;
        const copy = box.animate(
          effect.getKeyframes(),
          effect.getTiming() as KeyframeAnimationOptions,
        );
        copy.currentTime = animation.currentTime;
        trackAnimation(box, copy);
      }
  }
}

const inFlowBoxes = (element: HTMLElement) =>
  (Array.from(element.children) as HTMLElement[]).filter(
    (child) =>
      !child.hasAttribute(ATTR_SR) &&
      !child.hasAttribute(ATTR_EXITING) &&
      !child.hasAttribute(ATTR_TEXT),
  );

const queued = new Set<TextMorph>();
let scheduled = false;
let flushing = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    flush();
  });
}

/** Runs every queued update phase by phase: all reads of one phase, then all its writes. */
function flush() {
  // An update queued from a callback mid-flush joins the next round of this loop.
  if (flushing) return;
  flushing = true;
  let failure: unknown = null;
  try {
    while (queued.size) {
      if (queued.size === 1) {
        // The common case, one instance on its own: nothing to step in time with.
        const [morph] = queued;
        queued.clear();
        try {
          while (morph!.step());
        } catch (error) {
          failure ??= error;
        }
        continue;
      }
      let live = [...queued];
      queued.clear();
      while (live.length) {
        live = live.filter((morph) => {
          try {
            return morph.step();
          } catch (error) {
            failure ??= error;
            return false;
          }
        });
      }
    }
  } finally {
    flushing = false;
  }
  if (failure) throw failure;
}

export class TextMorph {
  private element: HTMLElement;
  private options: Omit<TextMorphOptions, "element" | "ease"> & {
    ease?: string;
  } = {};

  private data: HTMLElement | string;

  private currentMeasures: Measures = {};
  private prevMeasures: Measures = {};
  /** The last morph's, for splitting its boxes in the next — only a morph lays out the twin that reads it. */
  private frame: Frame = { a: 1, b: 0, c: 0, d: 1 };
  private previousSegments: Segment[] = [];
  // `previousSegments` with ligatures joined — what the DOM holds, and the diff never sees.
  private renderedSegments: Segment[] = [];
  // Runs drawn as one box, by their joined ID: what to split them back into when they change.
  private runParts = new Map<string, Segment[]>();
  private isInitialRender = true;
  private reducedMotion: ReducedMotionState | null = null;
  private srNode: HTMLElement | null = null;
  // Set at rest: the value as one run of text, laid out by the browser rather than in boxes.
  private textNode: HTMLElement | null = null;
  private generation = 0;
  private settling: ReturnType<typeof setTimeout> | undefined;
  private hasSetup = false;
  // From a morph's start until it settles: exactly one of complete and cancel ends it.
  private morphing = false;
  private ownsDir = false;
  private pending: {
    value: HTMLElement | string | number;
    cursorIndex?: number;
    // A tween's step on the way to `data`, rather than a new value.
    frame?: boolean;
  } | null = null;
  private steps: Generator<void, void, void> | null = null;
  private animations: Map<Element, Animation[]> | null = null;
  private plugins: readonly AnyPlugin[];
  private owners: Map<string, AnyPlugin>;
  /** Every glyph a slot here can hold, or null with no slots to mask. */
  private slotInk: string | null;
  private isSlot = (kind: string) =>
    kind === "text"
      ? this.plugins.some((plugin) => plugin.animate?.text?.slot)
      : !!this.owners.get(kind)?.kinds?.[kind]?.slot;
  // The current morph's: what it waits on, and what aborts it.
  private waits: Promise<unknown>[] = [];
  private abort: AbortController | null = null;
  // Lingering boxes whose exit has finished, removed once they leave the line.
  private spent = new Set<HTMLElement>();
  // What's on screen, which mid-tween isn't `data`; and the tween in flight.
  private shown = "";
  private tween: AbortController | null = null;
  private tweening = false;

  constructor(options: TextMorphOptions) {
    // A prop left off in JSX arrives as an explicit `undefined`, which would spread
    // over the default rather than fall back to it — and `undefined * fraction` is NaN.
    const given = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    ) as TextMorphOptions;

    // Set, the author's list replaces torph's own; `[]` is the engine alone.
    const plugins = given.plugins ?? CLASSIC;
    const { ease: rawEase, ...rest } = {
      ...DEFAULT_TEXT_MORPH_OPTIONS,
      ...given,
      // The author's ease, else the first plugin's that has one.
      ease:
        given.ease ??
        plugins.find((plugin) => plugin.ease)?.ease ??
        DEFAULT_TEXT_MORPH_OPTIONS.ease,
    };
    const { ease, duration } = resolveEase(rawEase, rest.duration!);

    this.options = { ...rest, ease, duration };
    this.plugins = plugins;
    this.owners = kindOwners(this.plugins);
    this.slotInk = slotInk(this.plugins);

    this.element = options.element;

    if (this.options.respectReducedMotion) {
      this.reducedMotion = createReducedMotionListener();
    }

    this.data = "";

    if (!this.isDisabled()) this.setup();
  }

  /** Deferred, not done in the constructor: `prefers-reduced-motion` can change after it. */
  private setup() {
    if (this.hasSetup) return;
    this.hasSetup = true;

    this.element.setAttribute(ATTR_ROOT, "");
    if (this.options.debug) this.element.setAttribute(ATTR_DEBUG, "");
    // A box per letter has no direction of its own, so the root's orders them; it comes from the text.
    this.ownsDir = !this.element.hasAttribute("dir");
    addStyles(this.plugins.flatMap((plugin) => plugin.css ?? []));
  }

  destroy() {
    queued.delete(this);
    this.pending = null;
    this.steps = null;
    this.animations = null;
    this.generation++;
    clearTimeout(this.settling);
    this.morphing = false;
    this.abort?.abort();
    this.stopTween();
    // With the stand-in gone, the text is the only copy left to read.
    this.textNode?.removeAttribute("aria-hidden");
    this.textNode = null;
    this.reducedMotion?.destroy();
    clearContainerTransition(this.element);
    this.element.getAnimations().forEach((anim) => anim.cancel());
    // Its own rules keep it out of sight, and those go with the last instance.
    this.srNode?.remove();
    this.srNode = null;
    for (const plugin of this.plugins) plugin.teardown?.(this.element);
    this.element.style.removeProperty(VAR_INK_TOP);
    this.element.style.removeProperty(VAR_INK_BOTTOM);
    this.element.removeAttribute(ATTR_ROOT);
    if (this.ownsDir) {
      this.element.removeAttribute("dir");
      this.ownsDir = false;
    }
    this.element.removeAttribute(ATTR_DEBUG);
    // An instance that never ran setup must not decrement the stylesheet refcount.
    if (this.hasSetup) {
      this.hasSetup = false;
      removeStyles();
    }
  }

  private isDisabled(): boolean {
    return Boolean(
      this.options.disabled ||
        this.reducedMotion?.prefersReducedMotion ||
        // A hidden tab draws no frames, so exits never finish and pile up in the DOM.
        (typeof document !== "undefined" &&
          document.visibilityState === "hidden"),
    );
  }

  /** `cursorIndex` switches a single-number value from place matching to caret matching. */
  update(value: HTMLElement | string | number, cursorIndex?: number) {
    this.pending = { value, cursorIndex };
    queued.add(this);
    flush();
  }

  /**
   * As `update`, but run with every other instance queued this tick, so all their layout
   * reads share one pass rather than each forcing its own.
   * @internal
   */
  queue(value: HTMLElement | string | number, cursorIndex?: number) {
    this.pending = { value, cursorIndex };
    queued.add(this);
    schedule();
  }

  /** @internal Runs the update's next phase; false once it has finished. */
  step(): boolean {
    if (!this.steps) {
      const pending = this.pending;
      if (!pending) return false;
      this.pending = null;
      this.steps = pending.frame
        ? this.passing(pending.value as string)
        : this.morph(pending.value, pending.cursorIndex);
    }
    holdAnimations(this.animations);
    try {
      if (!this.steps.next().done) return true;
      this.steps = null;
      return false;
    } catch (error) {
      this.steps = null;
      throw error;
    } finally {
      this.animations = releaseAnimations();
      if (!this.steps) this.animations = null;
    }
  }

  private *morph(
    value: HTMLElement | string | number,
    cursorIndex?: number,
  ): Generator<void, void, void> {
    const formatted =
      typeof value === "number"
        ? value.toLocaleString(this.options.locale, {
            minimumFractionDigits: this.options.decimals,
            maximumFractionDigits: this.options.decimals,
          })
        : value;

    if (formatted === this.data) return;
    this.data = formatted;
    this.stopTween();

    if (this.isDisabled()) {
      if (typeof formatted === "string") {
        // Plain text is already the whole accessible value.
        this.srNode = null;
        this.textNode = null;
        this.generation++;
        this.morphing = false;
        clearContainerTransition(this.element);
        this.abort?.abort();
        this.shown = formatted;
        this.element.textContent = formatted;
        // A later diff against these would animate from elements no longer in the DOM.
        this.previousSegments = [];
        this.renderedSegments = [];
        this.isInitialRender = true;
      }
      return;
    }

    this.setup();

    if (this.data instanceof HTMLElement) {
      // TODO: handle HTMLElement case
      throw new Error("HTMLElement not yet supported");
    }
    if (!this.isInitialRender) {
      if (this.morphing) this.options.onAnimationCancel?.();
      this.morphing = true;
      // Before the reconcile, so an interrupted hook stops writing into boxes the next morph owns.
      this.abort?.abort();
      this.abort = new AbortController();
      this.waits = [];
      this.options.onAnimationStart?.();
    }
    const tween = this.isInitialRender
      ? undefined
      : this.plugins.find((plugin) => plugin.tween);
    const frames =
      tween?.tween!(this.shown, this.data, {
        duration: this.options.duration!,
      }) ?? [];
    if (frames.length > 0) {
      yield;
      // Now, not at the first step: a reader shouldn't hear the old value while the count starts.
      this.syncAccessibleText(this.data);
      this.play(frames);
      return;
    }
    yield* this.render(this.data, cursorIndex);
  }

  private *render(
    value: string,
    cursorIndex?: number,
  ): Generator<void, void, void> {
    yield* this.createTextGroup(value, this.element, cursorIndex);
    this.shown = value;
  }

  /** One of a tween's values: its own morph, interrupting the last as quick updates do. */
  private *passing(value: string): Generator<void, void, void> {
    this.abort?.abort();
    this.abort = new AbortController();
    this.waits = [];
    yield* this.render(value);
  }

  /** Queues each of a tween's values at its time; the whole tween completes or cancels once. */
  private play(frames: { value: string; at: number }[]) {
    const tween = (this.tween = new AbortController());
    this.tweening = true;
    frames.forEach((frame, i) => {
      const timer = setTimeout(() => {
        // A new value waiting to run stops the tween itself.
        if (tween.signal.aborted || this.pending) return;
        if (i === frames.length - 1) this.tweening = false;
        this.pending = { value: frame.value, frame: true };
        queued.add(this);
        flush();
      }, frame.at);
      tween.signal.addEventListener("abort", () => clearTimeout(timer));
    });
  }

  private stopTween() {
    this.tween?.abort();
    this.tween = null;
    this.tweening = false;
  }

  /** Each `yield` sits between a read phase and a write phase; a batch runs every instance's phase before the next. */
  private *createTextGroup(
    value: string,
    element: HTMLElement,
    cursorIndex?: number,
  ): Generator<void, void, void> {
    // Before the running transition is aborted below, so an interrupt carries on from screen.
    const style = this.isInitialRender ? null : getComputedStyle(element);
    const oldSize = style && layoutSize(element, style);
    // Read before any write, and prepared before the "before" measure, so both FLIP measures agree.
    const states = style
      ? this.readPlugins(value, style)
      : new Map<AnyPlugin, unknown>();
    const where = style
      ? snapshotAnimations(element)
      : new Map<Element, Where>();
    const shaping = style && readShaping(style);

    let segments: Segment[];
    let splits: Map<string, Segment[]>;

    const whole = this.plugins.find((plugin) => plugin.whole);
    const cut = whole && this.cutWhole(whole, value);
    if (cut) {
      segments = cut;
      splits = new Map();
    } else if (this.previousSegments.length > 0) {
      const result = diffSegments(
        this.previousSegments,
        value,
        this.options.locale!,
        { plugins: this.plugins, cursorIndex },
      );
      segments = result.segments;
      splits = result.splits;
    } else {
      segments = segmentText(value, this.options.locale!, this.plugins);
      splits = new Map();
    }

    // A zero-width space keeps in-flow content, preserving line box height during exits.
    const isEmptyTransition = segments.length === 0;
    if (isEmptyTransition) {
      segments = [{ id: EMPTY_ID, string: "​" }];
    }
    const diffed = segments;
    // What the boxes draw, which a whole cut can make differ from the value.
    const drawn = diffed.map((s) => s.string).join("");
    const boxed = this.boxed(value);
    // What the morph doesn't touch stays whole: one box per run, drawn as the text draws it.
    // Mid-morph, only the runs already drawn whole, where they still hold: joining one drawn in parts would swap its boxes.
    const runs = boxed
      ? { before: [], after: [], keys: [] }
      : this.textNode
        ? stableRuns(this.previousSegments, diffed)
        : {
            before: [],
            after: intactRuns([...this.runParts.values()], diffed),
            keys: [],
          };
    const lines = joinRuns(diffed, runs.after);
    segments = ligate(lines.segments, shaping);

    const newIds = new Set(segments.map((b) => b.id));
    // Only a morph with a slot on either side needs its mask measured.
    const slotted = (list: Segment[]) =>
      list.some((segment) => this.isSlot(segment.kind ?? "text"));
    const clip =
      style &&
      this.slotInk &&
      (slotted(segments) || slotted(this.renderedSegments))
        ? slotClip(style, this.slotInk)
        : NO_CLIP;

    if (!oldSize) {
      yield;
      this.syncText(value);
      this.rest(drawn);
      this.previousSegments = diffed;
      this.renderedSegments = diffed;
      this.runParts = new Map();
      this.isInitialRender = false;
      element.style.width = "";
      element.style.height = "";
      if (boxed) {
        yield;
        const out = this.readSplit(new Map(), null, []);
        yield;
        this.split(out);
      }
      return;
    }

    const { width: oldWidth, height: oldHeight } = oldSize;
    // A run drawn whole that this morph changes goes back to its parts first, then any word in it.
    // Its arrows and joined letters stay joined, so nothing a ligature drew comes apart.
    const reopened = new Map(
      [...this.runParts]
        .filter(([id]) => !newIds.has(id))
        .map(([id, parts]) => [id, ligate(parts, shaping)]),
    );
    const outgoing = this.textNode
      ? this.readSplit(splits, shaping, runs.before)
      : null;
    const reopenedLetters = outgoing
      ? null
      : lettersOf(element, reopened, this.frame);
    yield;

    // The mask's reach, before the "before" measure: a slot's padding is part of its box.
    if (clip.inkTop !== null && clip.inkBottom !== null) {
      setStyleVar(element, VAR_INK_TOP, `${clip.inkTop.toFixed(4)}em`);
      setStyleVar(element, VAR_INK_BOTTOM, `${clip.inkBottom.toFixed(4)}em`);
    }
    for (const plugin of this.plugins) {
      const prepare = plugin.prepare;
      if (prepare)
        this.guard(
          () => prepare(element, states.get(plugin)),
          plugin,
          "prepare",
        );
    }
    // Sized to the text they replace, so the measure below reads where the text had them.
    if (outgoing) this.split(outgoing);
    else {
      splitWordSpans(element, reopened, this.isSlot);
      fitLetters(element, reopened, reopenedLetters!);
    }
    yield;

    const letters = outgoing ? null : lettersOf(element, splits, this.frame);
    yield;

    if (letters) {
      splitWordSpans(element, splits, this.isSlot);
      fitLetters(element, splits, letters);
    }
    this.syncText(value);
    // Out of flow and unseen: the new value laid out by the browser, for the boxes to match.
    const twin = textOf(drawn);
    twin.style.cssText =
      "position: absolute; left: 0; top: 0; visibility: hidden";
    element.append(twin);
    yield;

    const target = layoutOf(twin, segments);
    this.frame = target.frame;
    this.prevMeasures = measure(this.element, target.frame);
    // The stand-in has no ID, so the exit path would claim it and animate it away.
    const oldChildren = (Array.from(element.children) as HTMLElement[]).filter(
      (child) => child !== twin && !child.hasAttribute(ATTR_SR),
    );
    const inFlow = oldChildren.filter(
      (child) => !child.hasAttribute(ATTR_EXITING),
    );

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute(ATTR_ID) as string) &&
        !child.hasAttribute(ATTR_EXITING),
    );

    const exitingSet = new Set(exiting);
    const oldIds = inFlow.map((c) => c.getAttribute(ATTR_ID) as string);
    const exitingAnchorId = resolveExitingAnchors(
      inFlow,
      exitingSet,
      oldIds,
      newIds,
    );
    const lingers =
      Math.max(0, ...this.plugins.map((p) => p.linger ?? 0)) *
      this.options.duration!;
    const detached = lingers > 0 ? null : readDetached(element, exiting);
    // Text the last morph left lingering leaves with this morph's exits, so the measure above saw it in place.
    const lingered = this.lingering();
    const lingeredAt = lingered.length ? readDetached(element, lingered) : null;
    // The previous morph's text per box, before the reconcile rewrites any of it.
    const was = new Map(this.renderedSegments.map((s) => [s.id, s.string]));
    const leavingRuns = this.claimRuns(
      // A line break leaves no box to move, so it ends a leaving run.
      replacedRuns(
        inFlow,
        new Set(exiting.filter((child) => child.tagName !== "BR")),
      ),
      "exit",
      this.renderedSegments,
    );
    yield;

    twin.remove();
    if (lingeredAt) this.collapse(lingered, lingeredAt, true);
    if (detached) {
      placeDetached(exiting, detached);
      // Its translation is in left/top now, and the rest of its transform is set on it: starting
      // it from where it was would count the translation twice.
      for (const child of exiting) where.delete(child);
    } else {
      // Still in the line, so what arrives lands around it; it leaves the line later.
      // Line breaks too, so a removed line keeps its own row until the line closes up.
      for (const child of exiting) {
        child.setAttribute(ATTR_EXITING, "");
        child.setAttribute(ATTR_LINGER, "");
      }
    }
    reconcileChildren(element, oldChildren, newIds, segments, this.isSlot);
    fitBoxes(inFlowBoxes(element), target);
    yield;

    this.currentMeasures = measure(this.element, target.frame);
    const lingering = exiting.filter((child) =>
      child.hasAttribute(ATTR_LINGER),
    );
    const lingerNow = lingering.length
      ? measureBoxes(element, lingering, target.frame)
      : {};

    // One line's worth. The root is nowrap, so a line exists only where the value put one.
    const lineCount = segments.reduce(
      (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
      1,
    );
    const height = (element.offsetHeight || 20 * lineCount) / lineCount;
    const line = { height, clear: height + clip.top + clip.bottom };
    yield;

    // Measured at the old width, not derived — text-align does nothing to overflowing content.
    element.style.width = `${oldWidth}px`;
    yield;

    const firstFrameMeasures = measure(this.element, target.frame);
    const moving = this.readStyles(segments);
    const exitRuns = this.rectsOf(leavingRuns.claimed);
    yield;

    element.style.width = "";
    const leaving = exiting.filter(
      (child) =>
        child.getAttribute(ATTR_ID) !== EMPTY_ID &&
        !leavingRuns.taken.has(child),
    );
    const after = moving.children.filter(
      (child) => !child.hasAttribute(ATTR_EXITING),
    );
    const oldIdSet = new Set(oldIds);
    const scene: Scene = {
      states,
      line,
      animate: (element, keyframes, options, shift) =>
        animateFrom(where, element, keyframes, options, shift),
      arriving: 0,
      leaving: leaving.length,
      was,
      pairs: replacements(
        inFlow,
        exitingSet,
        after,
        new Set(
          after.filter((box) => !oldIdSet.has(box.getAttribute(ATTR_ID)!)),
        ),
      ),
    };
    this.updateStyles(segments, firstFrameMeasures, scene, moving);
    this.moveRuns(exitRuns, "exit", scene);

    for (const child of exiting) {
      if (child.getAttribute(ATTR_ID) === EMPTY_ID) child.remove();
    }
    leaving.forEach((child, index) => {
      const id = child.getAttribute(ATTR_ID)!;
      const lingers = child.hasAttribute(ATTR_LINGER);
      const anchorId = exitingAnchorId.get(child);
      // A lingering box stays in the line, so it only slides to where the line now puts it.
      const { dx, dy } =
        !lingers && anchorId
          ? computeDelta(this.currentMeasures, this.prevMeasures, anchorId)
          : { dx: 0, dy: 0 };
      if (lingers) {
        const { dx: fx, dy: fy } = computeDelta(
          this.prevMeasures,
          lingerNow,
          id,
        );
        if (fx || fy) {
          child.animate(
            [
              { transform: `translate(${fx}px, ${fy}px)` },
              { transform: "none" },
            ],
            {
              duration: this.options.duration!,
              easing: this.options.ease!,
              composite: "add",
            },
          );
        }
      }

      this.move(
        "exit",
        child.getAttribute(ATTR_KIND) ?? "text",
        child,
        { x: dx, y: dy },
        index,
        scene,
        // Unhandled, it just goes: when the line closes up if it lingers, else now.
        () =>
          child.hasAttribute(ATTR_LINGER)
            ? this.spent.add(child)
            : child.remove(),
      );
    });

    if (lingering.length) {
      const signal = this.abort!.signal;
      this.waits.push(
        new Promise<void>((resolve) =>
          setTimeout(() => {
            if (!signal.aborted) this.closeUp();
            resolve();
          }, lingers),
        ),
      );
    }

    this.previousSegments = diffed;
    this.renderedSegments = segments;
    this.runParts = lines.parts;

    if (isEmptyTransition) {
      holdContainerSize(element, oldWidth, oldHeight, this.options.duration!);
    } else {
      const resize = releaseContainerSize(element, oldWidth, oldHeight);
      if (resize) {
        yield;
        const size = layoutSize(element);
        yield;
        resizeContainer(
          element,
          resize,
          size,
          this.options.duration!,
          this.options.ease!,
        );
      }
    }

    this.settle();
  }

  /** Swaps the boxes for one run of text — the browser's own layout, kerning and shaping. */
  private rest(value: string) {
    for (const node of Array.from(this.element.childNodes)) {
      if (node !== this.srNode) node.remove();
    }
    this.textNode = textOf(value);
    this.element.append(this.textNode);
  }

  /** Whether a plugin keeps `value` in boxes at rest, to style or move them there. */
  private boxed(value: string) {
    return this.plugins.some((plugin) => plugin.boxes?.(value));
  }

  /** Reads where each outgoing segment sits in the text. */
  private readSplit(
    splits: Map<string, Segment[]>,
    shaping: Shaping | null,
    runs: [number, number][],
  ) {
    const segments = ligate(
      joinRuns(this.previousSegments, runs).segments,
      shaping,
    ).flatMap((segment) => splits.get(segment.id) ?? [segment]);
    return { segments, layout: layoutOf(this.textNode!, segments) };
  }

  /** Draws the outgoing segments as boxes where `readSplit` found them. */
  private split({ segments, layout }: { segments: Segment[]; layout: Layout }) {
    this.textNode!.remove();
    this.textNode = null;
    reconcileChildren(
      this.element,
      [],
      new Set(segments.map((s) => s.id)),
      segments,
      this.isSlot,
    );
    fitBoxes(inFlowBoxes(this.element), layout);
    this.renderedSegments = segments;
  }

  /** Waits out every animation, hook and the container, then goes back to plain text. */
  private settle() {
    const generation = ++this.generation;
    const check = () => {
      if (generation !== this.generation || !this.hasSetup) return;
      if (this.waits.length > 0) {
        Promise.allSettled(this.waits.splice(0)).then(check);
        return;
      }
      const busy = this.element.getAnimations({ subtree: true }).filter(
        (a) =>
          (a.playState === "running" || a.playState === "paused") &&
          // An endless animation is ambient, like a shimmer; it never finishes to wait on.
          a.effect?.getComputedTiming().endTime !== Infinity,
      );
      if (busy.length > 0) {
        Promise.allSettled(busy.map((a) => a.finished)).then(check);
      } else if (isContainerSettling(this.element)) {
        requestAnimationFrame(check);
      } else {
        if (!this.boxed(this.shown)) this.rest(this.shown);
        // Complete means at rest — after the join, not when the container stops.
        if (this.morphing && !this.tweening) {
          this.morphing = false;
          this.options.onAnimationComplete?.();
        }
      }
    };
    clearTimeout(this.settling);
    // Not before the morph could be over: each getAnimations() walks every animation the page has made since its last GC.
    this.settling = setTimeout(check, this.options.duration);
  }

  /** Each plugin's state for this morph; `read` is skipped for one the value can't involve. */
  private readPlugins(value: string, style: CSSStyleDeclaration) {
    const states = new Map<AnyPlugin, unknown>();
    for (const plugin of this.plugins) {
      const involved =
        !plugin.touches ||
        plugin.touches(value) ||
        this.previousSegments.some(
          (s) => s.kind && this.owners.get(s.kind) === plugin,
        );
      states.set(
        plugin,
        involved && plugin.read
          ? plugin.read(this.element, style, { from: this.shown, to: value })
          : plugin.idle,
      );
    }
    return states;
  }

  /** A plugin's cut of the whole value; the previous IDs are reserved, so a new one can't take one by chance. */
  private cutWhole(plugin: AnyPlugin, value: string) {
    const alloc = createIdAllocator();
    for (const segment of this.previousSegments) alloc.reserve(segment.id);
    return plugin.whole!(value, {
      locale: this.options.locale!,
      previous: this.previousSegments,
      id: pluginIds(plugin, alloc),
    });
  }

  private lingering() {
    return (Array.from(this.element.children) as HTMLElement[]).filter(
      (child) => child.hasAttribute(ATTR_LINGER),
    );
  }

  /** Takes lingering text out of the line, where `readDetached` found it, its exit left running. */
  private collapse(
    boxes: HTMLElement[],
    at: ReturnType<typeof readDetached>,
    hurry = false,
  ) {
    placeDetached(boxes, at, false);
    // Cut short by a new change, what's left of its exit plays out fast, so it can't pile up under the next one's.
    const cap = this.options.duration! * 0.3;
    for (const box of boxes) {
      box.removeAttribute(ATTR_LINGER);
      if (this.spent.delete(box)) box.remove();
      else if (hurry)
        for (const animation of box.getAnimations()) {
          const end = Number(animation.effect?.getComputedTiming().endTime);
          const left = end - Number(animation.currentTime ?? 0);
          if (Number.isFinite(left) && left > cap)
            animation.updatePlaybackRate(left / cap);
        }
    }
  }

  /** Once lingering text has had its time: it leaves the line, and the line closes up as its own small morph. */
  private closeUp() {
    const element = this.element;
    const still = this.lingering();
    if (still.length === 0) return;
    const before = measure(element, this.frame);
    const size = layoutSize(element);
    const staying = (Array.from(element.children) as HTMLElement[]).filter(
      (child) =>
        !child.hasAttribute(ATTR_EXITING) &&
        before[child.getAttribute(ATTR_ID) ?? ""],
    );
    // Where a box still sliding from the morph has got to, so closing up carries on from there.
    const moving = new Map(
      staying.map((child) => [child, readAnimationState(child)]),
    );
    this.collapse(still, readDetached(element, still));
    const after = measure(element, this.frame);
    for (const child of staying) {
      const { dx, dy } = computeDelta(
        before,
        after,
        child.getAttribute(ATTR_ID)!,
      );
      if (!dx && !dy) continue;
      animateEnterOrPersist(child, {
        previous: moving.get(child),
        deltaX: dx,
        deltaY: dy,
        isNew: false,
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
    }
    transitionContainerSize(
      element,
      size.width,
      size.height,
      this.options.duration!,
      this.options.ease!,
    );
  }

  /** Offers each run to the plugins; a plugin that claims one with no hook for it hands it back to the boxes. */
  private claimRuns(
    runs: HTMLElement[][],
    side: "enter" | "exit",
    rendered: Segment[],
  ) {
    const taken = new Set<HTMLElement>();
    const claimed: [AnyPlugin, HTMLElement[]][] = [];
    const byId = new Map(rendered.map((s) => [s.id, s]));
    for (const run of runs) {
      const segments = run.map((box) => {
        const id = box.getAttribute(ATTR_ID)!;
        return byId.get(id) ?? { id, string: box.textContent ?? "" };
      });
      const plugin = this.plugins.find((p) => p.runs?.claim(segments, side));
      if (!plugin?.runs![side]) continue;
      for (const box of run) taken.add(box);
      claimed.push([plugin, run]);
    }
    return { taken, claimed };
  }

  /** A run's shape is a read, so it's taken in a read phase and handed to the hook. */
  private rectsOf(claimed: [AnyPlugin, HTMLElement[]][]): Claimed {
    return claimed.map(([plugin, run]) => [
      plugin,
      run,
      run.map((box) => box.getBoundingClientRect()),
    ]);
  }

  private moveRuns(
    claimed: Claimed,
    side: "enter" | "exit",
    scene: Scene,
    previous?: Map<HTMLElement, AnimationState>,
  ) {
    for (const [plugin, run, rects] of claimed) {
      const ctx: RunContext<unknown> = {
        rects,
        from: run.map((box) => previous?.get(box)),
        line: scene.line,
        state: scene.states.get(plugin),
        duration: this.options.duration!,
        ease: this.options.ease!,
        animate: scene.animate,
        signal: this.abort!.signal,
      };
      this.wait(
        this.guard(() => plugin.runs![side]!(run, ctx), plugin, "runs", side),
        side === "exit" ? run : undefined,
      );
      // A run moves as one shape, but each box in it is still decorated, counted within its run.
      run.forEach((box, index) => {
        const id = box.getAttribute(ATTR_ID)!;
        this.decorate(side, box.getAttribute(ATTR_KIND) ?? "text", box, scene, {
          mover: moverOf(box),
          delta: { x: 0, y: 0 },
          from: previous?.get(box),
          index,
          arriving: side === "enter" ? run.length : 0,
          leaving: side === "exit" ? run.length : 0,
          was: scene.was.get(id),
          run: true,
          animate: scene.animate,
        });
      });
    }
  }

  /** Every plugin's decoration for a box, alongside whatever moves it. */
  private decorate(
    name: keyof Hooks<unknown>,
    kind: string,
    box: HTMLElement,
    scene: Scene,
    base: Omit<
      MotionContext<unknown>,
      "state" | "kind" | "line" | "duration" | "ease" | "signal"
    >,
  ) {
    for (const plugin of this.plugins) {
      const decorate = plugin.decorate;
      const hook = (decorate?.[kind] ?? decorate?.["*"])?.[name];
      if (!hook) continue;
      const ctx = {
        ...base,
        kind,
        line: scene.line,
        duration: this.options.duration!,
        ease: this.options.ease!,
        signal: this.abort!.signal,
        state: scene.states.get(plugin),
      };
      this.wait(
        this.guard(() => hook(box, ctx), plugin, "decorate", kind, name),
      );
    }
  }

  /**
   * Moves one box with its hook, or the engine's own motion, then runs every plugin's
   * decoration for it alongside.
   */
  private move(
    name: keyof Hooks<unknown>,
    kind: string,
    box: HTMLElement,
    delta: { x: number; y: number },
    index: number,
    scene: Scene,
    fallback: () => void,
    from?: AnimationState,
    moverFrom?: AnimationState,
  ) {
    const id = box.getAttribute(ATTR_ID)!;
    // The box's own layout moved by `delta`; its mover's, inside it, didn't.
    const animate: MotionContext<unknown>["animate"] = (
      element,
      keyframes,
      options,
    ) =>
      scene.animate(
        element,
        keyframes,
        options,
        element === box ? delta : undefined,
      );
    const base = {
      kind,
      mover: moverOf(box),
      delta,
      from,
      moverFrom,
      line: scene.line,
      duration: this.options.duration!,
      ease: this.options.ease!,
      animate,
      signal: this.abort!.signal,
      index,
      arriving: scene.arriving,
      leaving: scene.leaving,
      was: scene.was.get(id),
      replaces: name === "enter" ? scene.pairs.get(box) : undefined,
      replacedBy: name === "exit" ? scene.pairs.get(box) : undefined,
    };
    const found = this.hook(kind, name);
    if (found) {
      const [plugin, hook, section] = found;
      const ctx = { ...base, state: scene.states.get(plugin) };
      this.wait(
        this.guard(() => hook(box, ctx), plugin, section, kind, name),
        name === "exit" ? [box] : undefined,
      );
    } else {
      fallback();
    }
    this.decorate(name, kind, box, scene, base);
  }

  /** With `debug` on and `torph/debug` enabled, a hook that reads layout is named in a warning. */
  private guard(
    hook: () => Motion,
    plugin: AnyPlugin,
    section: string,
    kind?: string,
    name?: string,
  ): Motion {
    const guarded = this.options.debug
      ? ((globalThis as Record<symbol, unknown>)[DEBUG_GUARD] as
          | ((label: string, hook: () => Motion) => Motion)
          | undefined)
      : undefined;
    if (!guarded) return hook();
    const label = [plugin.name, section, kind, name].filter(Boolean).join(".");
    return guarded(label, hook);
  }

  /**
   * The settle waits on a returned motion; a leaving box goes once its motion has. A hook
   * that returns nothing is waited on through the root's own animations, as the engine's are.
   */
  private wait(motion: Motion, leaving?: HTMLElement[]) {
    const remove = () => {
      for (const box of leaving ?? []) {
        // Still holding its place: it goes when the line closes up.
        if (box.hasAttribute(ATTR_LINGER)) this.spent.add(box);
        else if (box.isConnected) box.remove();
      }
    };
    if (Array.isArray(motion) || motion instanceof Promise) {
      const done = Array.isArray(motion)
        ? Promise.allSettled(motion.map((a) => a.finished))
        : motion.catch(() => {});
      this.waits.push(done.then(remove));
    } else if (leaving) {
      const running = leaving.flatMap((box) => box.getAnimations());
      Promise.allSettled(running.map((a) => a.finished)).then(remove);
    }
  }

  /** The hook set a plugin gives a kind: its own, if it owns the kind, else its override. */
  private setFor(
    plugin: AnyPlugin,
    kind: string,
  ): HookSet<unknown> | undefined {
    return this.owners.get(kind) === plugin
      ? plugin.kinds?.[kind]
      : plugin.animate?.[kind];
  }

  /** A box's hook: the first plugin's, in order, with one for its kind, else the engine's own. */
  private hook<Name extends keyof Hooks<unknown>>(
    kind: string,
    name: Name,
  ): [AnyPlugin, Hooks<unknown>[Name], string] | undefined {
    for (const plugin of this.plugins) {
      const hook = this.setFor(plugin, kind)?.[name];
      if (hook) {
        const section = this.owners.get(kind) === plugin ? "kinds" : "animate";
        return [plugin, hook, section];
      }
    }
  }

  /** Where every moving box has got to, read before any animation starts so no write invalidates the rest. */
  private readStyles(segments: Segment[]) {
    const children = (
      Array.from(this.element.children) as HTMLElement[]
    ).filter((child) => !child.hasAttribute(ATTR_SR));
    // The arriving half of the same gesture.
    const settled = children.filter(
      (child) =>
        !child.hasAttribute(ATTR_EXITING) &&
        child.tagName !== "BR" &&
        child.getAttribute(ATTR_ID) !== EMPTY_ID,
    );
    const arriving = new Set(
      settled.filter(
        (child) => !this.prevMeasures[child.getAttribute(ATTR_ID)!],
      ),
    );
    const previous = new Map<HTMLElement, AnimationState>();
    for (const child of settled) {
      previous.set(child, readAnimationState(child));
      if (arriving.has(child) && child.hasAttribute(ATTR_KIND)) {
        const mover = moverOf(child);
        if (mover !== child) previous.set(mover, readAnimationState(mover));
      }
    }
    const runs = this.claimRuns(
      replacedRuns(settled, arriving),
      "enter",
      segments,
    );
    return {
      children,
      settled,
      arriving,
      previous,
      together: runs.taken,
      runs: this.rectsOf(runs.claimed),
    };
  }

  private updateStyles(
    segments: Segment[],
    firstFrameMeasures: Measures,
    scene: Scene,
    {
      children,
      settled,
      arriving,
      previous,
      together,
      runs,
    }: ReturnType<TextMorph["readStyles"]>,
  ) {
    const segmentIds = segments.map((b) => b.id);
    const kinds = new Map(segments.map((b) => [b.id, b.kind]));
    const strings = new Map(segments.map((b) => [b.id, b.string]));
    scene.arriving = settled.filter(
      (child) => arriving.has(child) && !together.has(child),
    ).length;
    this.moveRuns(runs, "enter", scene, previous);
    const counts = { enter: 0, persist: 0 };

    const persistentIds = new Set(
      segmentIds.filter((id) => this.prevMeasures[id]),
    );

    children.forEach((child, index) => {
      if (child.hasAttribute(ATTR_EXITING)) return;
      if (child.tagName === "BR") return;
      if (together.has(child)) return;
      const key = child.getAttribute(ATTR_ID) || `child-${index}`;
      if (key === EMPTY_ID) return;
      const isNew = !this.prevMeasures[key];

      const deltaKey = isNew
        ? findNearestAnchor(
            segments.findIndex((b) => b.id === key),
            segmentIds,
            persistentIds,
          )
        : key;

      const { dx: deltaX, dy: deltaY } = deltaKey
        ? computeDelta(this.prevMeasures, firstFrameMeasures, deltaKey)
        : { dx: 0, dy: 0 };

      // Already heading where it rests, with the same text, so left alone rather than restarted.
      if (
        !isNew &&
        Math.abs(deltaX) < STILL &&
        Math.abs(deltaY) < STILL &&
        scene.was.get(key) === strings.get(key)
      )
        return;

      const name = isNew ? "enter" : "persist";
      this.move(
        name,
        kinds.get(key) ?? "text",
        child,
        { x: deltaX, y: deltaY },
        counts[name]++,
        scene,
        // Unhandled, an arriving box just appears; a staying one still slides, or the line would jump.
        () =>
          isNew
            ? cancelAnimations(child, previous.get(child))
            : animateEnterOrPersist(child, {
                previous: previous.get(child),
                deltaX,
                deltaY,
                isNew,
                duration: this.options.duration!,
                ease: this.options.ease!,
              }),
        previous.get(child),
        previous.get(moverOf(child)),
      );
    });
  }

  /** After the split has read the rest text — a write before it costs every instance a layout. */
  private syncText(value: string) {
    // The reader hears where a tween is going, not every value on the way.
    this.syncAccessibleText(this.data as string);
    if (this.ownsDir) {
      const dir = directionOf(value);
      if (this.element.getAttribute("dir") !== dir)
        this.element.setAttribute("dir", dir);
    }
  }

  /** Holds the value as plain text — the segments are split and aria-hidden, so unreadable. */
  private syncAccessibleText(value: string) {
    if (!this.srNode || this.srNode.parentNode !== this.element) {
      const node = document.createElement("span");
      node.setAttribute(ATTR_SR, "");
      this.element.prepend(node);
      this.srNode = node;
    }

    this.srNode.textContent = value;
  }
}
