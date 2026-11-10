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
  type AnimationState,
  AT_REST,
  clearContainerTransition,
  floorContainerSize,
  holdContainerSize,
  layoutSize,
  readAnimationState,
  transitionContainerSize,
} from "../utils/animate";
import { afterLayout } from "../utils/layout";
import { animateExit, animateEnterOrPersist } from "./utils/animate";
import {
  animateNumberEnter,
  animateNumberExit,
  animateNumberPersist,
} from "./utils/number-animate";
import {
  type FlowSnapshot,
  detachFromFlow,
  snapshotFlow,
  splitWordSpans,
  reconcileChildren,
} from "../utils/dom";
import {
  animateGroupEnter,
  animateGroupExit,
  originsFor,
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
  ATTR_STAGE,
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
  steady: false,
} as const satisfies Omit<TextMorphOptions, "element">;

/** All a steady morph asks of the page, taken after the frame's layout and before its first write. */
type Reads = {
  width: number;
  height: number;
  prev: Measures;
  next: Measures;
  slideDistance: number;
  exits: Map<HTMLElement, FlowSnapshot>;
  states: Map<HTMLElement, AnimationState>;
  /** By segment ID — an arriving run is read off stand-ins, not the elements it animates. */
  origins: Map<string, string>;
};

// A first render animates nothing, so it has nothing to ask.
const NO_READS: Reads = {
  width: 0,
  height: 0,
  prev: {},
  next: {},
  slideDistance: 0,
  exits: new Map(),
  states: new Map(),
  origins: new Map(),
};

const originsOf = (reads: Reads | undefined, run: HTMLElement[]) =>
  reads && run.map((child) => reads.origins.get(child.getAttribute(ATTR_ID)!)!);

// One line's worth is slid. The root is nowrap, so a line exists only where the value put one.
const lineCountOf = (segments: Segment[]) =>
  segments.reduce(
    (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
    1,
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
  private isInitialRender = true;
  private reducedMotion: ReducedMotionState | null = null;
  private srNode: HTMLElement | null = null;
  private hasSetup = false;
  /** Withdraws a steady morph that is still waiting on layout. */
  private unstage: (() => void) | null = null;

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
    this.unstage?.();
    this.unstage = null;
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

    // It never drew, so the next morph starts from the same screen — but it was started.
    if (this.unstage) {
      this.unstage();
      this.unstage = null;
      this.options.onAnimationCancel?.();
    }

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
    const steady = this.options.steady;
    // Before the running transition is aborted below, so an interrupt carries on from screen.
    // Steady asks nothing yet: an update lands on a page other writes have left unlaid.
    const old = steady ? NO_READS : layoutSize(element);
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

    if (!steady) {
      this.commit(segments, isEmptyTransition, old);
      return;
    }
    if (this.isInitialRender) {
      this.commit(segments, isEmptyTransition, old, NO_READS);
      return;
    }

    // What is drawn, split words included — the next diff starts here if this one never draws.
    this.previousSegments = this.previousSegments.flatMap(
      (segment) => splits.get(segment.id) ?? [segment],
    );

    const stage = document.createElement("span");
    stage.setAttribute(ATTR_STAGE, "");
    stage.setAttribute("aria-hidden", "true");
    reconcileChildren(stage, [], new Set(), segments);
    this.srNode!.after(stage);

    const cancel = afterLayout(stage, () => {
      const reads = this.read(stage, segments);
      return () => {
        this.unstage = null;
        stage.remove();
        this.commit(segments, isEmptyTransition, reads, reads);
      };
    });
    this.unstage = () => {
      cancel();
      stage.remove();
    };
  }

  /** The children on screen, and the ones the new value has no place for. */
  private outgoing(segments: Segment[]) {
    // The stand-in has no ID, so the exit path would claim it and animate it away.
    const oldChildren = (
      Array.from(this.element.children) as HTMLElement[]
    ).filter(
      (child) =>
        !child.hasAttribute(ATTR_SR) && !child.hasAttribute(ATTR_STAGE),
    );
    const newIds = new Set(segments.map((b) => b.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute(ATTR_ID) as string) &&
        !child.hasAttribute(ATTR_EXITING),
    );

    return { oldChildren, newIds, exiting };
  }

  /** The old value where it is drawn and the new one where the stage has laid it. */
  private read(stage: HTMLElement, segments: Segment[]): Reads {
    const element = this.element;
    const { width, height } = layoutSize(element);
    const { oldChildren, exiting } = this.outgoing(segments);
    const leaving = exiting.filter((child) => child.tagName !== "BR");

    const states = new Map<HTMLElement, AnimationState>();
    for (const child of oldChildren) {
      if (child.hasAttribute(ATTR_EXITING) || child.tagName === "BR") continue;
      states.set(child, readAnimationState(child));
    }

    const exits = new Map<HTMLElement, FlowSnapshot>();
    for (const child of leaving) {
      exits.set(child, snapshotFlow(element, child, states.get(child)));
    }

    const prev = measure(element);
    const next = measure(stage, element);

    const standIns = (Array.from(stage.children) as HTMLElement[]).filter(
      (child) =>
        child.tagName !== "BR" && child.getAttribute(ATTR_ID) !== EMPTY_ID,
    );
    const arriving = new Set(
      standIns.filter((child) => !prev[child.getAttribute(ATTR_ID)!]),
    );
    const origins = new Map<string, string>();
    const runs = [
      ...replacedRuns(oldChildren, new Set(leaving)),
      ...replacedRuns(standIns, arriving),
    ];
    for (const run of runs) {
      originsFor(run).forEach((origin, i) =>
        origins.set(run[i]!.getAttribute(ATTR_ID)!, origin),
      );
    }

    const lineCount = lineCountOf(segments);

    return {
      width,
      height,
      prev,
      next,
      // The stage has no height of its own, so its lines are all overflow.
      slideDistance: (stage.scrollHeight || 20 * lineCount) / lineCount,
      exits,
      states,
      origins,
    };
  }

  /** Given `reads`, this writes and asks nothing; without, it measures as it goes. */
  private commit(
    segments: Segment[],
    isEmptyTransition: boolean,
    old: { width: number; height: number },
    reads?: Reads,
  ) {
    const element = this.element;
    const steady = this.options.steady;

    this.prevMeasures = reads?.prev ?? measure(element);
    const { oldChildren, newIds, exiting } = this.outgoing(segments);

    const exitingSet = new Set(exiting);
    const oldIds = oldChildren.map((c) => c.getAttribute(ATTR_ID) as string);
    const exitingAnchorId = resolveExitingAnchors(
      oldChildren,
      exitingSet,
      oldIds,
      newIds,
    );

    detachFromFlow(element, exiting, reads?.exits);
    reconcileChildren(element, oldChildren, newIds, segments);

    this.currentMeasures = reads?.next ?? measure(element);

    const lineCount = lineCountOf(segments);
    const slideDistance =
      reads?.slideDistance ??
      (element.offsetHeight || 20 * lineCount) / lineCount;

    // Steady, the root is as wide as the wider value from the first frame, and the stage read it so.
    let firstFrameMeasures = this.currentMeasures;
    if (!reads) {
      // Measured at the old width, not derived — text-align does nothing to overflowing content.
      element.style.width = `${old.width}px`;
      void element.offsetWidth;
      firstFrameMeasures = measure(element);
      element.style.width = "";
    }

    this.updateStyles(segments, firstFrameMeasures, slideDistance, reads);

    // A run with no survivors inside it recedes as one shape.
    const leavingRuns = this.isInitialRender
      ? []
      : replacedRuns(oldChildren, new Set(exiting));
    const leavingTogether = new Set(leavingRuns.flat());

    for (const run of leavingRuns) {
      animateGroupExit(run, {
        duration: this.options.duration!,
        ease: this.options.ease!,
        steady,
        origins: originsOf(reads, run),
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
          steady,
        });
      } else {
        animateExit(child, {
          dx,
          dy,
          duration: this.options.duration!,
          ease: this.options.ease!,
          scale: this.options.scale!,
          steady,
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

    if (reads) {
      floorContainerSize(
        element,
        old.width,
        old.height,
        this.options.duration!,
        this.options.onAnimationComplete,
        this.options.onAnimationCancel,
      );
    } else if (isEmptyTransition) {
      holdContainerSize(
        element,
        old.width,
        old.height,
        this.options.duration!,
        this.options.onAnimationComplete,
        this.options.onAnimationCancel,
      );
    } else {
      transitionContainerSize(
        element,
        old.width,
        old.height,
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
    reads?: Reads,
  ) {
    if (this.isInitialRender) return;

    const steady = this.options.steady;

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
        steady,
        origins: originsOf(reads, run),
        previous: reads && run.map(() => AT_REST),
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
      // An element the stage never saw is a new one, and a new one is at rest.
      const previous = reads && (reads.states.get(child) ?? AT_REST);

      if (kind && isNew) {
        animateNumberEnter(child, {
          deltaX,
          deltaY,
          slideDistance,
          kind,
          duration: this.options.duration!,
          ease: this.options.ease!,
          steady,
          previous,
          moverPrevious: reads && AT_REST,
        });
      } else if (kind) {
        animateNumberPersist(child, {
          deltaX,
          deltaY,
          duration: this.options.duration!,
          ease: this.options.ease!,
          previous,
        });
      } else {
        animateEnterOrPersist(child, {
          deltaX,
          deltaY,
          isNew,
          duration: this.options.duration!,
          ease: this.options.ease!,
          steady,
          previous,
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
