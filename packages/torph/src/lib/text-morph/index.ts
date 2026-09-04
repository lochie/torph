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
  layoutSize,
  transitionContainerSize,
} from "../utils/animate";
import { animateExit, animateEnterOrPersist } from "./utils/animate";
import {
  animateNumberEnter,
  animateNumberExit,
  animateNumberPersist,
} from "./utils/number-animate";
import {
  detachFromFlow,
  splitWordSpans,
  reconcileChildren,
} from "../utils/dom";
import {
  animateGroupEnter,
  animateGroupExit,
  replacedRuns,
} from "./utils/replace-animate";
import { diffSegments } from "./utils/diff";
import { addStyles, removeStyles } from "../utils/styles";
import {
  ATTR_ROOT,
  ATTR_DEBUG,
  ATTR_EXITING,
  ATTR_ID,
  ATTR_KIND,
  ATTR_SR,
  EMPTY_ID,
} from "../utils/constants";
import {
  type ReducedMotionState,
  createReducedMotionListener,
} from "../utils/reduced-motion";

export type { TextMorphOptions } from "./types";
export type { SpringParams } from "../utils/spring";
export { MorphController } from "./controller";

export const DEFAULT_AS = "span";
export const DEFAULT_TEXT_MORPH_OPTIONS = {
  ...BASE_DEFAULTS,
  debug: false,
  scale: true,
  numbers: true,
} as const satisfies Omit<TextMorphOptions, "element">;

export class TextMorph {
  private element: HTMLElement;
  private options: Omit<TextMorphOptions, "element" | "ease"> & {
    ease?: string;
  } = {};

  private data: HTMLElement | string;

  private currentMeasures: Measures = {};
  private prevMeasures: Measures = {};
  private previousSegments: Segment[] = [];
  private isInitialRender = true;
  private reducedMotion: ReducedMotionState | null = null;
  private srNode: HTMLElement | null = null;
  private hasSetup = false;

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
    addStyles();
  }

  destroy() {
    this.reducedMotion?.destroy();
    clearContainerTransition(this.element);
    this.element.getAnimations().forEach((anim) => anim.cancel());
    // Its own rules keep it out of sight, and those go with the last instance.
    this.srNode?.remove();
    this.srNode = null;
    this.element.removeAttribute(ATTR_ROOT);
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
        this.element.textContent = formatted;
        // A later diff against these would animate from elements no longer in the DOM.
        this.previousSegments = [];
        this.isInitialRender = true;
      }
      return;
    }

    this.setup();

    if (this.data instanceof HTMLElement) {
      // TODO: handle HTMLElement case
      throw new Error("HTMLElement not yet supported");
    } else {
      if (this.options.onAnimationStart && !this.isInitialRender) {
        this.options.onAnimationStart();
      }
      this.createTextGroup(this.data, this.element, cursorIndex);
    }
  }

  private createTextGroup(
    value: string,
    element: HTMLElement,
    cursorIndex?: number,
  ) {
    // Before the running transition is aborted below, so an interrupt carries on from screen.
    const { width: oldWidth, height: oldHeight } = layoutSize(element);
    const numbers = this.options.numbers !== false;

    this.syncAccessibleText(value);

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

    splitWordSpans(element, splits);

    this.prevMeasures = measure(this.element);
    // The stand-in has no ID, so the exit path would claim it and animate it away.
    const oldChildren = (Array.from(element.children) as HTMLElement[]).filter(
      (child) => !child.hasAttribute(ATTR_SR),
    );
    const newIds = new Set(segments.map((b) => b.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute(ATTR_ID) as string) &&
        !child.hasAttribute(ATTR_EXITING),
    );

    const exitingSet = new Set(exiting);
    const oldIds = oldChildren.map((c) => c.getAttribute(ATTR_ID) as string);
    const exitingAnchorId = resolveExitingAnchors(
      oldChildren,
      exitingSet,
      oldIds,
      newIds,
    );

    detachFromFlow(element, exiting);
    reconcileChildren(element, oldChildren, newIds, segments);

    this.currentMeasures = measure(this.element);

    // One line's worth. The root is nowrap, so a line exists only where the value put one.
    const lineCount = segments.reduce(
      (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
      1,
    );
    const slideDistance = (element.offsetHeight || 20 * lineCount) / lineCount;

    // Measured at the old width, not derived — text-align does nothing to overflowing content.
    element.style.width = `${oldWidth}px`;
    void element.offsetWidth;
    const firstFrameMeasures = measure(this.element);
    element.style.width = "";

    this.updateStyles(segments, firstFrameMeasures, slideDistance);

    // A run with no survivors inside it recedes as one shape.
    const leavingRuns = this.isInitialRender
      ? []
      : replacedRuns(oldChildren, new Set(exiting));
    const leavingTogether = new Set(leavingRuns.flat());

    for (const run of leavingRuns) {
      animateGroupExit(run, {
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
    }

    exiting.forEach((child) => {
      if (this.isInitialRender || child.getAttribute(ATTR_ID) === EMPTY_ID) {
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

    this.previousSegments = segments;

    if (this.isInitialRender) {
      this.isInitialRender = false;
      element.style.width = "";
      element.style.height = "";
      return;
    }

    if (isEmptyTransition) {
      holdContainerSize(
        element,
        oldWidth,
        oldHeight,
        this.options.duration!,
        this.options.onAnimationComplete,
        this.options.onAnimationCancel,
      );
    } else {
      transitionContainerSize(
        element,
        oldWidth,
        oldHeight,
        this.options.duration!,
        this.options.ease!,
        this.options.onAnimationComplete,
        this.options.onAnimationCancel,
      );
    }
  }

  private updateStyles(
    segments: Segment[],
    firstFrameMeasures: Measures,
    slideDistance: number,
  ) {
    if (this.isInitialRender) return;

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
    for (const run of replacedRuns(settled, arriving)) {
      run.forEach((child) => arrivingTogether.add(child));
      animateGroupEnter(run, {
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
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
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else if (kind) {
        animateNumberPersist(child, {
          deltaX,
          deltaY,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else {
        animateEnterOrPersist(child, {
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
