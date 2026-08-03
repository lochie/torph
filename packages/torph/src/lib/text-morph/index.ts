import type { TextMorphOptions } from "./types";
import { spring as resolveSpring } from "./utils/spring";
import { type Segment, segmentText } from "./utils/segment";
import {
  type Measures,
  measure,
  computeDelta,
  findNearestAnchor,
  resolveExitingAnchors,
} from "./utils/flip";
import {
  animateExit,
  animateEnterOrPersist,
  clearContainerTransition,
  holdContainerSize,
  transitionContainerSize,
} from "./utils/animate";
import { detachFromFlow, splitWordSpans, reconcileChildren } from "./utils/dom";
import { diffSegments } from "./utils/diff";
import { addStyles, removeStyles } from "./utils/styles";
import {
  ATTR_ROOT,
  ATTR_DEBUG,
  ATTR_EXITING,
  ATTR_ID,
  EMPTY_ID,
} from "./utils/constants";
import {
  type ReducedMotionState,
  createReducedMotionListener,
} from "./utils/reduced-motion";

export type { TextMorphOptions } from "./types";
export type { SpringParams } from "./utils/spring";
export { MorphController } from "./controller";

export const DEFAULT_AS = "span";
export const DEFAULT_TEXT_MORPH_OPTIONS = {
  debug: false,
  locale: "en",
  duration: 400,
  scale: true,
  ease: "cubic-bezier(0.19, 1, 0.22, 1)",
  disabled: false,
  respectReducedMotion: true,
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

  constructor(options: TextMorphOptions) {
    const { ease: rawEase, ...rest } = {
      ...DEFAULT_TEXT_MORPH_OPTIONS,
      ...options,
    };
    let ease: string;
    let duration: number;

    if (typeof rawEase === "object") {
      const resolved = resolveSpring(rawEase);
      ease = resolved.easing;
      duration = resolved.duration;
    } else {
      ease = rawEase;
      duration = rest.duration!;
    }

    this.options = { ...rest, ease, duration };

    this.element = options.element;

    if (this.options.respectReducedMotion) {
      this.reducedMotion = createReducedMotionListener();
    }

    if (!this.isDisabled()) {
      this.element.setAttribute(ATTR_ROOT, "");
      if (options.debug) this.element.setAttribute(ATTR_DEBUG, "");
    }

    this.data = "";
    if (!this.isDisabled()) {
      addStyles();
    }
  }

  destroy() {
    this.reducedMotion?.destroy();
    clearContainerTransition(this.element);
    this.element.getAnimations().forEach((anim) => anim.cancel());
    this.element.removeAttribute(ATTR_ROOT);
    this.element.removeAttribute(ATTR_DEBUG);
    removeStyles();
  }

  private isDisabled(): boolean {
    return Boolean(
      this.options.disabled || this.reducedMotion?.prefersReducedMotion,
    );
  }

  update(value: HTMLElement | string) {
    if (value === this.data) return;
    this.data = value;

    if (this.isDisabled()) {
      if (typeof value === "string") {
        this.element.textContent = value;
      }
      return;
    }

    if (this.data instanceof HTMLElement) {
      // TODO: handle HTMLElement case
      throw new Error("HTMLElement not yet supported");
    } else {
      if (this.options.onAnimationStart && !this.isInitialRender) {
        this.options.onAnimationStart();
      }
      this.createTextGroup(this.data, this.element);
    }
  }

  private createTextGroup(value: string, element: HTMLElement) {
    // Measured before a running transition is aborted below, so an interrupted
    // morph carries on from the size on screen rather than snapping.
    const oldRect = element.getBoundingClientRect();
    const oldWidth = oldRect.width;
    const oldHeight = oldRect.height;

    let segments: Segment[];
    let splits: Map<string, Segment[]>;

    if (this.previousSegments.length > 0) {
      const result = diffSegments(
        this.previousSegments,
        value,
        this.options.locale!,
      );
      segments = result.segments;
      splits = result.splits;
    } else {
      segments = segmentText(value, this.options.locale!);
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
    const oldChildren = Array.from(element.children) as HTMLElement[];
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

    // First-frame positions have to be measured at the old width, not derived
    // from it — text-align has no effect on content that overflows.
    element.style.width = `${oldWidth}px`;
    void element.offsetWidth;
    const firstFrameMeasures = measure(this.element);
    element.style.width = "auto";

    this.updateStyles(segments, firstFrameMeasures);

    exiting.forEach((child) => {
      if (this.isInitialRender || child.getAttribute(ATTR_ID) === EMPTY_ID) {
        child.remove();
        return;
      }

      const anchorId = exitingAnchorId.get(child);
      const { dx, dy } = anchorId
        ? computeDelta(this.currentMeasures, this.prevMeasures, anchorId)
        : { dx: 0, dy: 0 };

      animateExit(child, {
        dx,
        dy,
        duration: this.options.duration!,
        ease: this.options.ease!,
        scale: this.options.scale!,
      });
    });

    this.previousSegments = segments;

    if (this.isInitialRender) {
      this.isInitialRender = false;
      element.style.width = "auto";
      element.style.height = "auto";
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

  private updateStyles(segments: Segment[], firstFrameMeasures: Measures) {
    if (this.isInitialRender) return;

    const children = Array.from(this.element.children) as HTMLElement[];
    const segmentIds = segments.map((b) => b.id);

    const persistentIds = new Set(
      segmentIds.filter((id) => this.prevMeasures[id]),
    );

    children.forEach((child, index) => {
      if (child.hasAttribute(ATTR_EXITING)) return;
      if (child.tagName === "BR") return;
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

      animateEnterOrPersist(child, {
        deltaX,
        deltaY,
        isNew,
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
    });
  }
}
