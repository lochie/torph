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
  transitionContainerSize,
} from "../utils/animate";
import { animateExit, animateEnterOrPersist } from "./utils/animate";
import {
  animateNumberEnter,
  animateNumberExit,
  animateNumberPersist,
} from "./utils/number-animate";
import { detachFromFlow, splitWordSpans, reconcileChildren } from "../utils/dom";
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
    const { ease: rawEase, ...rest } = {
      ...DEFAULT_TEXT_MORPH_OPTIONS,
      ...options,
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

  /**
   * Deferred rather than done once in the constructor, because whether it is
   * wanted can change after it: `prefers-reduced-motion` is live, and an
   * instance built while it was on has no root attribute and no stylesheet. The
   * first morph after it goes off would otherwise animate against neither.
   */
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
    // Its own rules are what keep it out of sight, and those go with the last
    // instance — left behind, it would render as a second copy of the value.
    this.srNode?.remove();
    this.srNode = null;
    this.element.removeAttribute(ATTR_ROOT);
    this.element.removeAttribute(ATTR_DEBUG);
    // Only ever added by `setup`, so an instance that never ran one must not
    // decrement the count and pull the stylesheet out from under the others.
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

  /**
   * `cursorIndex` switches a value that is a single number from place matching
   * to caret matching — what an editable field wants, where the character the
   * user just typed is known and place value is not the point.
   */
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
        // Plain text is already the whole accessible value, so the stand-in
        // goes with the segments this wipes.
        this.srNode = null;
        this.element.textContent = formatted;
        // Nothing of what those segments described is in the DOM any more. Were
        // reduced motion to go off again, a diff against them would animate
        // from elements that no longer exist.
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
    // Measured before a running transition is aborted below, so an interrupted
    // morph carries on from the size on screen rather than snapping.
    const oldRect = element.getBoundingClientRect();
    const oldWidth = oldRect.width;
    const oldHeight = oldRect.height;
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

    // Keep a zero-width space segment so the container always has in-flow
    // content, preserving the line box height during exit animations.
    const isEmptyTransition = segments.length === 0;
    if (isEmptyTransition) {
      segments = [{ id: EMPTY_ID, string: "\u200B" }];
    }

    splitWordSpans(element, splits);

    this.prevMeasures = measure(this.element);
    // The accessible stand-in is not a segment and has no ID, so it would read
    // as an old child with no counterpart in the new value — detached from the
    // flow and animated away on the first morph.
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

    // One line's worth, not the whole block. Every line box is the same height
    // here — the root is `white-space: nowrap`, so a line exists only where the
    // value put a newline — which makes counting them exact.
    const lineCount = segments.reduce(
      (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
      1,
    );
    const slideDistance = (element.offsetHeight || 20 * lineCount) / lineCount;

    // First-frame positions have to be measured at the old width, not derived
    // from it — text-align has no effect on content that overflows.
    element.style.width = `${oldWidth}px`;
    void element.offsetWidth;
    const firstFrameMeasures = measure(this.element);
    element.style.width = "";

    this.updateStyles(segments, firstFrameMeasures, slideDistance);

    // A stretch of the old value with nothing surviving inside it recedes as
    // one shape. Anything shorter still has a survivor close enough to move
    // relative to, so it keeps its own exit.
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
      settled.filter((child) => !this.prevMeasures[child.getAttribute(ATTR_ID)!]),
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

  /**
   * Holds the value as ordinary text for anything reading the root rather than
   * looking at it. The segments cannot serve: a morph splits words to the
   * character to move their halves apart, and leaves the previous value's
   * characters in the DOM until they have finished animating out, so what is
   * actually in there is one letter per box with the last value's leftovers
   * still interleaved. Every one of those carries `aria-hidden`, and this is
   * what is left to read.
   *
   * Kept first so it is reached before them, and re-found whenever it is gone —
   * a disabled-mode write replaces the root's contents wholesale.
   */
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
