import type { TextMorphOptions } from "./types";
import { BASE_DEFAULTS, type Segment } from "../utils/types";
import { resolveEase } from "../utils/spring";
import { segmentText } from "./utils/segment";
import {
  type Frame,
  type Measures,
  type Placed,
  measure,
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
  animationsOf,
  holdAnimations,
  releaseAnimations,
  releaseContainerSize,
  resizeContainer,
  snapshotAnimations,
  trackAnimation,
  type AnimationState,
} from "../utils/animate";
import { animateExit, animateEnterOrPersist } from "./utils/animate";
import {
  animateNumberEnter,
  animateNumberExit,
  animateNumberPersist,
  slotClip,
  NO_CLIP,
} from "./utils/number-animate";
import {
  placeDetached,
  readDetached,
  splitWordSpans,
  reconcileChildren,
  moverOf,
} from "../utils/dom";
import {
  animateGroupEnter,
  animateGroupExit,
  replacedRuns,
} from "./utils/replace-animate";
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
  ATTR_ID,
  ATTR_KIND,
  ATTR_SR,
  ATTR_TEXT,
  EMPTY_ID,
  VAR_INK_TOP,
  VAR_INK_BOTTOM,
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

// An unchanged write would still restyle every slot.
function setStyleVar(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value) {
    element.style.setProperty(name, value);
  }
}
export const DEFAULT_TEXT_MORPH_OPTIONS = {
  ...BASE_DEFAULTS,
  debug: false,
  scale: true,
  numbers: true,
} as const satisfies Omit<TextMorphOptions, "element">;

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
  private hasSetup = false;
  // From a morph's start until it settles: exactly one of complete and cancel ends it.
  private morphing = false;
  private ownsDir = false;
  private pending: {
    value: HTMLElement | string | number;
    cursorIndex?: number;
  } | null = null;
  private steps: Generator<void, void, void> | null = null;
  private animations: Map<Element, Animation[]> | null = null;

  constructor(options: TextMorphOptions) {
    // A prop left off in JSX arrives as an explicit `undefined`, which would spread
    // over the default rather than fall back to it — and `undefined * fraction` is NaN.
    const given = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    ) as TextMorphOptions;

    const { ease: rawEase, ...rest } = {
      ...DEFAULT_TEXT_MORPH_OPTIONS,
      ...given,
    };
    const { ease, duration } = resolveEase(rawEase, rest.duration!);

    this.options = { ...rest, ease, duration };

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
    addStyles();
  }

  destroy() {
    queued.delete(this);
    this.pending = null;
    this.steps = null;
    this.animations = null;
    this.generation++;
    this.morphing = false;
    // With the stand-in gone, the text is the only copy left to read.
    this.textNode?.removeAttribute("aria-hidden");
    this.textNode = null;
    this.reducedMotion?.destroy();
    clearContainerTransition(this.element);
    this.element.getAnimations().forEach((anim) => anim.cancel());
    // Its own rules keep it out of sight, and those go with the last instance.
    this.srNode?.remove();
    this.srNode = null;
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
      this.options.disabled || this.reducedMotion?.prefersReducedMotion,
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
      this.steps = this.morph(pending.value, pending.cursorIndex);
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

    if (this.isDisabled()) {
      if (typeof formatted === "string") {
        // Plain text is already the whole accessible value.
        this.srNode = null;
        this.textNode = null;
        this.generation++;
        this.morphing = false;
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
      this.options.onAnimationStart?.();
    }
    yield* this.createTextGroup(this.data, this.element, cursorIndex);
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
    // Read before any write, and applied before the "before" measure, so both FLIP measures share one padding.
    const hasNumbers =
      this.options.numbers !== false &&
      (/\d/.test(value) || this.previousSegments.some((s) => s.kind));
    const clip = style && (hasNumbers ? slotClip(style) : NO_CLIP);
    if (style) snapshotAnimations(element);
    const numbers = this.options.numbers !== false;
    const shaping = style && readShaping(style);

    let segments: Segment[];
    let splits: Map<string, Segment[]>;

    if (this.previousSegments.length > 0) {
      const result = diffSegments(
        this.previousSegments,
        value,
        this.options.locale!,
        { numbers, cursorIndex },
      );
      segments = result.segments;
      splits = result.splits;
    } else {
      segments = segmentText(value, this.options.locale!, numbers);
      splits = new Map();
    }

    // A zero-width space keeps in-flow content, preserving line box height during exits.
    const isEmptyTransition = segments.length === 0;
    if (isEmptyTransition) {
      segments = [{ id: EMPTY_ID, string: "\u200B" }];
    }
    const diffed = segments;
    // What the morph doesn't touch stays whole: one box per run, drawn as the text draws it.
    // Mid-morph, only the runs already drawn whole, where they still hold: joining one drawn in parts would swap its boxes.
    const runs = this.textNode
      ? stableRuns(this.previousSegments, diffed)
      : {
          before: [],
          after: intactRuns([...this.runParts.values()], diffed),
          keys: [],
        };
    const lines = joinRuns(diffed, runs.after);
    segments = ligate(lines.segments, shaping);

    const newIds = new Set(segments.map((b) => b.id));

    if (!oldSize) {
      yield;
      this.syncText(value);
      this.rest(value);
      this.previousSegments = diffed;
      this.renderedSegments = diffed;
      this.runParts = new Map();
      this.isInitialRender = false;
      element.style.width = "";
      element.style.height = "";
      return;
    }

    const { width: oldWidth, height: oldHeight } = oldSize;
    const { inkTop, inkBottom, top: clipTop, bottom: clipBottom } = clip!;
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

    // Only a new font changes these, so most morphs write nothing.
    if (inkTop !== null && inkBottom !== null) {
      setStyleVar(element, VAR_INK_TOP, `${inkTop.toFixed(4)}em`);
      setStyleVar(element, VAR_INK_BOTTOM, `${inkBottom.toFixed(4)}em`);
    }
    // Sized to the text they replace, so the measure below reads where the text had them.
    if (outgoing) this.split(outgoing);
    else {
      splitWordSpans(element, reopened);
      fitLetters(element, reopened, reopenedLetters!);
    }
    yield;

    const letters = outgoing ? null : lettersOf(element, splits, this.frame);
    yield;

    if (letters) {
      splitWordSpans(element, splits);
      fitLetters(element, splits, letters);
    }
    this.syncText(value);
    // Out of flow and unseen: the new value laid out by the browser, for the boxes to match.
    const twin = textOf(value);
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
    const detached = readDetached(element, exiting);
    yield;

    twin.remove();
    placeDetached(exiting, detached);
    reconcileChildren(element, oldChildren, newIds, segments);
    fitBoxes(inFlowBoxes(element), target);
    yield;

    this.currentMeasures = measure(this.element, target.frame);

    // One line's worth. The root is nowrap, so a line exists only where the value put one.
    const lineCount = segments.reduce(
      (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
      1,
    );
    const lineHeight = (element.offsetHeight || 20 * lineCount) / lineCount;
    // A digit has to clear the whole clip, which can outgrow a tight line.
    const slideDistance = lineHeight + clipTop + clipBottom;
    yield;

    // Measured at the old width, not derived — text-align does nothing to overflowing content.
    element.style.width = `${oldWidth}px`;
    yield;

    const firstFrameMeasures = measure(this.element, target.frame);
    const moving = this.readStyles();
    yield;

    element.style.width = "";
    this.updateStyles(segments, firstFrameMeasures, slideDistance, moving);

    // A run with no survivors inside it recedes as one shape.
    const leavingRuns = replacedRuns(inFlow, new Set(exiting));
    const leavingTogether = new Set(leavingRuns.flat());

    for (const run of leavingRuns) {
      animateGroupExit(run, {
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
    }

    exiting.forEach((child) => {
      if (child.getAttribute(ATTR_ID) === EMPTY_ID) {
        child.remove();
        return;
      }
      if (leavingTogether.has(child)) return;

      const anchorId = exitingAnchorId.get(child);
      const { dx, dy } = anchorId
        ? computeDelta(this.currentMeasures, this.prevMeasures, anchorId)
        : { dx: 0, dy: 0 };

      if (child.hasAttribute(ATTR_KIND)) {
        animateNumberExit(child, {
          dx,
          dy,
          slideDistance,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else {
        animateExit(child, {
          dx,
          dy,
          duration: this.options.duration!,
          ease: this.options.ease!,
          scale: this.options.scale!,
        });
      }
    });

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
    );
    fitBoxes(inFlowBoxes(this.element), layout);
    this.renderedSegments = segments;
  }

  /** Waits out every animation and the container, then goes back to plain text. */
  private settle() {
    const generation = ++this.generation;
    const check = () => {
      if (generation !== this.generation || !this.hasSetup) return;
      const busy = this.element
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === "running" || a.playState === "paused");
      if (busy.length > 0) {
        Promise.allSettled(busy.map((a) => a.finished)).then(check);
      } else if (isContainerSettling(this.element)) {
        requestAnimationFrame(check);
      } else {
        this.rest(this.data as string);
        // Complete means at rest — after the join, not when the container stops.
        if (this.morphing) {
          this.morphing = false;
          this.options.onAnimationComplete?.();
        }
      }
    };
    queueMicrotask(check);
  }

  /** Where every moving box has got to, read before any animation starts so no write invalidates the rest. */
  private readStyles() {
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
    return { children, settled, arriving, previous };
  }

  private updateStyles(
    segments: Segment[],
    firstFrameMeasures: Measures,
    slideDistance: number,
    {
      children,
      settled,
      arriving,
      previous,
    }: ReturnType<TextMorph["readStyles"]>,
  ) {
    const segmentIds = segments.map((b) => b.id);
    const kinds = new Map(segments.map((b) => [b.id, b.kind]));
    const arrivingTogether = new Set<HTMLElement>();
    for (const run of replacedRuns(settled, arriving)) {
      run.forEach((child) => arrivingTogether.add(child));
      animateGroupEnter(
        run,
        {
          duration: this.options.duration!,
          ease: this.options.ease!,
        },
        previous,
      );
    }

    const persistentIds = new Set(
      segmentIds.filter((id) => this.prevMeasures[id]),
    );

    children.forEach((child, index) => {
      if (child.hasAttribute(ATTR_EXITING)) return;
      if (child.tagName === "BR") return;
      if (arrivingTogether.has(child)) return;
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

      const kind = kinds.get(key);

      if (kind && isNew) {
        animateNumberEnter(child, {
          deltaX,
          deltaY,
          slideDistance,
          kind,
          previous: previous.get(child),
          moverPrevious: previous.get(moverOf(child)),
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else if (kind) {
        animateNumberPersist(child, {
          previous: previous.get(child),
          deltaX,
          deltaY,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else {
        animateEnterOrPersist(child, {
          previous: previous.get(child),
          deltaX,
          deltaY,
          isNew,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      }
    });
  }

  /** After the split has read the rest text — a write before it costs every instance a layout. */
  private syncText(value: string) {
    this.syncAccessibleText(value);
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
