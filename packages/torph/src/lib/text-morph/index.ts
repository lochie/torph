import type { TextMorphOptions } from "./types";
import { BASE_DEFAULTS, type Segment } from "../utils/types";
import { resolveEase } from "../utils/spring";
import { segmentText } from "./utils/segment";
import {
  type Measures,
  measure,
  computeDelta,
  findNearestAnchor,
  resolveExitingAnchors,
} from "../utils/flip";
import {
  clearContainerTransition,
  holdContainerSize,
  isContainerSettling,
  layoutSize,
  transitionContainerSize,
  readAnimationState,
  releaseAnimations,
  snapshotAnimations,
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
  detachFromFlow,
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
import { type Kerning, ligate, readKerning } from "./utils/kerning";
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
  const probe = document.createElement("i");
  probe.style.cssText = `position: absolute; left: 0; top: 0; width: ${PROBE}px; height: 0`;
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
  /** A layout pixel along the line, on screen: scale times cos and |sin| of any rotation. */
  along: number;
  across: number;
};

/** Where each segment sits in the text — null for a line break. */
function layoutOf(text: HTMLElement, segments: Segment[]): Layout {
  const unit = text.firstElementChild!.getBoundingClientRect();
  const lines = Array.from(text.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  );
  const range = document.createRange();
  let line = 0;
  let offset = 0;
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
    offset = end;
    return range.getBoundingClientRect();
  });
  return { rects, along: unit.width / PROBE, across: unit.height / PROBE };
}

/**
 * Sizes each box to the advance its segment has in the text — up to where the next one
 * starts, so the kerning between them comes with it and the boxes lay out as the text does.
 * Rects are on screen, so a transformed ancestor's scale and rotation are taken back out.
 */
function fitBoxes(boxes: HTMLElement[], { rects, along, across }: Layout) {
  const scale = Math.hypot(along, across);
  const squash = along * along - across * across;
  // No layout (display: none), or turned past 45°, where a bounding box no longer gives a width back.
  if (!(scale > 0) || !(squash > 0)) return;
  boxes.forEach((box, i) => {
    const rect = rects[i];
    if (!rect || box.tagName === "BR") return;
    const next = rects[i + 1];
    const advance = next
      ? Math.hypot(next.left - rect.left, next.top - rect.top) / scale
      : (rect.width * along - rect.height * across) / squash;
    const width = `${+advance.toFixed(3)}px`;
    if (box.style.width !== width) box.style.width = width;
  });
}

const inFlowBoxes = (element: HTMLElement) =>
  (Array.from(element.children) as HTMLElement[]).filter(
    (child) =>
      !child.hasAttribute(ATTR_SR) &&
      !child.hasAttribute(ATTR_EXITING) &&
      !child.hasAttribute(ATTR_TEXT),
  );

export class TextMorph {
  private element: HTMLElement;
  private options: Omit<TextMorphOptions, "element" | "ease"> & {
    ease?: string;
  } = {};

  private data: HTMLElement | string;

  private currentMeasures: Measures = {};
  private prevMeasures: Measures = {};
  private previousSegments: Segment[] = [];
  // `previousSegments` with ligatures joined — what the DOM holds, and the diff never sees.
  private renderedSegments: Segment[] = [];
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
    } else {
      if (!this.isInitialRender) {
        if (this.morphing) this.options.onAnimationCancel?.();
        this.morphing = true;
        this.options.onAnimationStart?.();
      }
      try {
        this.createTextGroup(this.data, this.element, cursorIndex);
      } finally {
        releaseAnimations();
      }
    }
  }

  private createTextGroup(
    value: string,
    element: HTMLElement,
    cursorIndex?: number,
  ) {
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
    const kerning = style && readKerning(style);

    this.syncAccessibleText(value);
    if (this.ownsDir) {
      const dir = directionOf(value);
      if (this.element.getAttribute("dir") !== dir)
        this.element.setAttribute("dir", dir);
    }

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
    segments = ligate(diffed, kerning);

    const newIds = new Set(segments.map((b) => b.id));

    if (!oldSize) {
      this.rest(value);
      this.previousSegments = diffed;
      this.renderedSegments = diffed;
      this.isInitialRender = false;
      element.style.width = "";
      element.style.height = "";
      return;
    }

    const { width: oldWidth, height: oldHeight } = oldSize;
    const { inkTop, inkBottom, top: clipTop, bottom: clipBottom } = clip!;
    // Only a new font changes these, so most morphs write nothing.
    if (inkTop !== null && inkBottom !== null) {
      setStyleVar(element, VAR_INK_TOP, `${inkTop.toFixed(4)}em`);
      setStyleVar(element, VAR_INK_BOTTOM, `${inkBottom.toFixed(4)}em`);
    }
    // Sized to the text they replace, so the measure below reads where the text had them.
    if (this.textNode) this.split(splits, kerning);
    else splitWordSpans(element, splits);
    // Out of flow and unseen: the new value laid out by the browser, for the boxes to match.
    const twin = textOf(value);
    twin.style.cssText =
      "position: absolute; left: 0; top: 0; visibility: hidden";
    element.append(twin);
    this.prevMeasures = measure(this.element);
    const target = layoutOf(twin, segments);
    twin.remove();
    // The stand-in has no ID, so the exit path would claim it and animate it away.
    const oldChildren = (Array.from(element.children) as HTMLElement[]).filter(
      (child) => !child.hasAttribute(ATTR_SR),
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

    detachFromFlow(element, exiting);
    reconcileChildren(element, oldChildren, newIds, segments);
    fitBoxes(inFlowBoxes(element), target);

    this.currentMeasures = measure(this.element);

    // One line's worth. The root is nowrap, so a line exists only where the value put one.
    const lineCount = segments.reduce(
      (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
      1,
    );
    const lineHeight = (element.offsetHeight || 20 * lineCount) / lineCount;
    // A digit has to clear the whole clip, which can outgrow a tight line.
    const slideDistance = lineHeight + clipTop + clipBottom;

    // Measured at the old width, not derived — text-align does nothing to overflowing content.
    element.style.width = `${oldWidth}px`;
    void element.offsetWidth;
    const firstFrameMeasures = measure(this.element);
    element.style.width = "";

    this.updateStyles(segments, firstFrameMeasures, slideDistance);

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

    if (isEmptyTransition) {
      holdContainerSize(element, oldWidth, oldHeight, this.options.duration!);
    } else {
      transitionContainerSize(
        element,
        oldWidth,
        oldHeight,
        this.options.duration!,
        this.options.ease!,
      );
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

  /** Reads where each outgoing segment sits in the text, then draws them as boxes there. */
  private split(splits: Map<string, Segment[]>, kerning: Kerning | null) {
    const text = this.textNode!;
    const segments = ligate(this.previousSegments, kerning).flatMap(
      (segment) => splits.get(segment.id) ?? [segment],
    );
    const layout = layoutOf(text, segments);

    text.remove();
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
      // Element by element: not every engine honours `subtree`.
      const busy = [
        this.element,
        ...Array.from(this.element.querySelectorAll("*")),
      ]
        .flatMap((el) => el.getAnimations())
        .filter((a) => a.playState === "running" || a.playState === "paused");
      if (busy.length > 0) {
        Promise.allSettled(busy.map((a) => a.finished)).then(check);
      } else if (isContainerSettling(this.element)) {
        requestAnimationFrame(check);
      } else {
        this.rest(this.data as string);
        if (this.morphing) {
          this.morphing = false;
          this.options.onAnimationComplete?.();
        }
      }
    };
    queueMicrotask(check);
  }

  private updateStyles(
    segments: Segment[],
    firstFrameMeasures: Measures,
    slideDistance: number,
  ) {
    const children = (
      Array.from(this.element.children) as HTMLElement[]
    ).filter((child) => !child.hasAttribute(ATTR_SR));
    const segmentIds = segments.map((b) => b.id);
    const kinds = new Map(segments.map((b) => [b.id, b.kind]));

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
    const arrivingTogether = new Set<HTMLElement>();
    // Snapshot every moving box before starting animations, so writes cannot invalidate later reads.
    const previous = new Map<HTMLElement, AnimationState>();
    for (const child of settled) {
      previous.set(child, readAnimationState(child));
      if (arriving.has(child) && child.hasAttribute(ATTR_KIND)) {
        const mover = moverOf(child);
        if (mover !== child) previous.set(mover, readAnimationState(mover));
      }
    }
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
