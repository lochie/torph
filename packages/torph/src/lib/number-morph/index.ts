import type { NumberMorphOptions } from "./types";
import { type NumberSegment, segmentNumber } from "./segment";
import {
  animateNumberExit,
  animateNumberEnter,
  animateNumberPersist,
} from "./animate";
import { resolveEase } from "../utils/spring";
import { BASE_DEFAULTS } from "../utils/types";
import {
  type Measures,
  measure,
  computeDelta,
  findNearestAnchor,
  resolveExitingAnchors,
} from "../utils/flip";
import {
  clearContainerTransition,
  transitionContainerSize,
} from "../utils/animate";
import { detachFromFlow, reconcileChildren } from "../utils/dom";
import { addStyles, removeStyles } from "../utils/styles";
import {
  ATTR_ROOT,
  ATTR_ID,
  ATTR_EXITING,
} from "../utils/constants";
import {
  type ReducedMotionState,
  createReducedMotionListener,
} from "../utils/reduced-motion";

export type { NumberMorphOptions } from "./types";
export type { NumberSegment } from "./segment";
export { NumberMorphController } from "./controller";

export const DEFAULT_NUMBER_MORPH_OPTIONS = {
  ...BASE_DEFAULTS,
} as const satisfies Omit<NumberMorphOptions, "element">;

export class NumberMorph {
  private element: HTMLElement;
  private duration: number;
  private ease: string;
  private locale: string;
  private decimals?: number;
  private disabled: boolean;
  private onAnimationStart?: () => void;
  private onAnimationComplete?: () => void;

  private currentValue = "";
  private prevMeasures: Measures = {};
  private currentMeasures: Measures = {};
  private currentSegments: NumberSegment[] = [];
  private isInitialRender = true;
  private reducedMotion: ReducedMotionState | null = null;

  constructor(options: NumberMorphOptions) {
    const opts = { ...DEFAULT_NUMBER_MORPH_OPTIONS, ...options };
    const { ease, duration } = resolveEase(opts.ease, opts.duration!);

    this.element = opts.element;
    this.duration = duration;
    this.ease = ease;
    this.locale = opts.locale!;
    this.decimals = opts.decimals;
    this.disabled = opts.disabled!;
    this.onAnimationStart = opts.onAnimationStart;
    this.onAnimationComplete = opts.onAnimationComplete;

    if (opts.respectReducedMotion) {
      this.reducedMotion = createReducedMotionListener();
    }

    if (!this.isDisabled()) {
      this.element.setAttribute(ATTR_ROOT, "");
      // Digits slide vertically past the line box on enter/exit
      this.element.style.overflow = "hidden";
      addStyles();
    }
  }

  destroy() {
    this.reducedMotion?.destroy();
    clearContainerTransition(this.element);
    this.element.getAnimations().forEach((anim) => anim.cancel());
    this.element.removeAttribute(ATTR_ROOT);
    removeStyles();
  }

  private isDisabled(): boolean {
    return Boolean(
      this.disabled || this.reducedMotion?.prefersReducedMotion,
    );
  }

  update(value: number | string, cursorIndex?: number) {
    const formatted =
      typeof value === "number"
        ? value.toLocaleString(this.locale, {
            minimumFractionDigits: this.decimals,
            maximumFractionDigits: this.decimals,
          })
        : value;

    if (formatted === this.currentValue) return;
    this.currentValue = formatted;

    if (this.isDisabled()) {
      this.element.textContent = formatted;
      return;
    }

    if (!this.isInitialRender && this.onAnimationStart) {
      this.onAnimationStart();
    }

    const segments = segmentNumber(formatted, this.currentSegments, cursorIndex);
    this.animate(segments);
  }

  private animate(segments: NumberSegment[]) {
    const element = this.element;
    // Subpixel, to match what transitionContainerSize measures the new size with
    const oldRect = element.getBoundingClientRect();
    const oldWidth = oldRect.width;
    const oldHeight = oldRect.height;
    const slideDistance = element.offsetHeight || 20;

    this.prevMeasures = measure(element);
    const oldChildren = Array.from(element.children) as HTMLElement[];
    const newIds = new Set(segments.map((s) => s.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute(ATTR_ID) as string) &&
        !child.hasAttribute(ATTR_EXITING),
    );
    const exitingSet = new Set(exiting);
    const oldIds = oldChildren.map(
      (c) => c.getAttribute(ATTR_ID) as string,
    );

    const exitingAnchorId = resolveExitingAnchors(
      oldChildren,
      exitingSet,
      oldIds,
      newIds,
    );

    detachFromFlow(element, exiting);
    reconcileChildren(element, oldChildren, newIds, segments);

    this.currentMeasures = measure(element);
    this.currentSegments = segments;

    exiting.forEach((child) => {
      if (this.isInitialRender) {
        child.remove();
        return;
      }

      const anchorId = exitingAnchorId.get(child);
      const { dx, dy } = anchorId
        ? computeDelta(this.currentMeasures, this.prevMeasures, anchorId)
        : { dx: 0, dy: 0 };

      animateNumberExit(child, {
        dx,
        dy,
        slideDistance,
        duration: this.duration,
        ease: this.ease,
      });
    });

    if (this.isInitialRender) {
      this.isInitialRender = false;
      element.style.width = "auto";
      element.style.height = "auto";
      return;
    }

    this.animateChildren(segments, slideDistance);

    transitionContainerSize(
      element,
      oldWidth,
      oldHeight,
      this.duration,
      this.ease,
      this.onAnimationComplete,
    );
  }

  private animateChildren(segments: NumberSegment[], slideDistance: number) {
    const segmentIds = segments.map((s) => s.id);
    const persistentIds = new Set(
      segmentIds.filter((id) => this.prevMeasures[id]),
    );
    const kindMap = new Map(segments.map((s) => [s.id, s.kind]));

    const children = Array.from(this.element.children) as HTMLElement[];
    children.forEach((child, index) => {
      if (child.hasAttribute(ATTR_EXITING)) return;

      const key = child.getAttribute(ATTR_ID) || `child-${index}`;
      const isNew = !this.prevMeasures[key];

      if (isNew) {
        const anchorKey = findNearestAnchor(
          segments.findIndex((s) => s.id === key),
          segmentIds,
          persistentIds,
        );

        const { dx: deltaX, dy: deltaY } = anchorKey
          ? computeDelta(this.prevMeasures, this.currentMeasures, anchorKey)
          : { dx: 0, dy: 0 };

        animateNumberEnter(child, {
          deltaX,
          deltaY,
          slideDistance,
          kind: kindMap.get(key) ?? "digit",
          duration: this.duration,
          ease: this.ease,
        });
      } else {
        const { dx: deltaX, dy: deltaY } = computeDelta(
          this.prevMeasures,
          this.currentMeasures,
          key,
        );

        animateNumberPersist(child, {
          deltaX,
          deltaY,
          duration: this.duration,
          ease: this.ease,
        });
      }
    });
  }
}
