import type { TextMorphOptions } from "./types";
import { BASE_DEFAULTS, type Segment } from "../utils/types";
import { resolveEase } from "../utils/spring";
import { segmentContent } from "./utils/segment";
import {
  type ContentPart,
  contentSignature,
  contentText,
  flattenContent,
} from "./utils/content";
import {
  type Measures,
  itemsOf,
  measure,
  computeDelta,
  findNearestAnchor,
  pairElementSlots,
  resolveExitingAnchors,
} from "../utils/flip";
import {
  clearContainerTransition,
  holdContainerSize,
  layoutSize,
  transitionContainerSize,
} from "../utils/animate";
import {
  animateExit,
  animateEnterOrPersist,
  animateElementEnter,
  animateElementExit,
  animateFormatChange,
} from "./utils/animate";
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
  ATTR_NODE,
  ATTR_SR,
  ATTR_WRAP,
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

  /** The value's identity, not the value — see `contentSignature`. */
  private data: string;

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
    if (this.options.wrap) this.element.setAttribute(ATTR_WRAP, "");
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
    this.element.removeAttribute(ATTR_WRAP);
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

  /**
   * `cursorIndex` switches a single-number value from place matching to caret matching.
   * An element source is read, never kept — its children are adopted into the root.
   */
  update(
    value: Element | string | number | ContentPart[],
    cursorIndex?: number,
  ) {
    const parts = this.toParts(value);

    const signature = contentSignature(parts);
    if (signature === this.data) return;
    this.data = signature;

    if (this.isDisabled()) {
      this.renderStatic(parts);
      return;
    }

    this.setup();

    if (this.options.onAnimationStart && !this.isInitialRender) {
      this.options.onAnimationStart();
    }
    this.createTextGroup(parts, this.element, cursorIndex);
  }

  private toParts(
    value: Element | string | number | ContentPart[],
  ): ContentPart[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return flattenContent(value);
    return [
      {
        kind: "text",
        value:
          typeof value === "number"
            ? value.toLocaleString(this.options.locale, {
                minimumFractionDigits: this.options.decimals,
                maximumFractionDigits: this.options.decimals,
              })
            : value,
      },
    ];
  }

  /** The value as it stands, unsplit and unhidden — the whole of reduced motion. */
  private renderStatic(parts: ContentPart[]) {
    this.srNode = null;
    this.element.replaceChildren(
      ...parts.map((part) => (part.kind === "text" ? part.value : part.node)),
    );
    // A later diff against these would animate from elements no longer in the DOM.
    this.previousSegments = [];
    this.isInitialRender = true;
  }

  private createTextGroup(
    parts: ContentPart[],
    element: HTMLElement,
    cursorIndex?: number,
  ) {
    // Before the running transition is aborted below, so an interrupt carries on from screen.
    const { width: oldWidth, height: oldHeight } = layoutSize(element);
    const numbers = this.options.numbers !== false;

    this.syncAccessibleText(contentText(parts));

    let segments: Segment[];
    let splits: Map<string, Segment[]>;

    if (this.previousSegments.length > 0) {
      const result = diffSegments(
        this.previousSegments,
        parts,
        this.options.locale!,
        { numbers, cursorIndex },
      );
      segments = result.segments;
      splits = result.splits;
    } else {
      segments = segmentContent(parts, this.options.locale!, numbers);
      splits = new Map();
    }

    // A zero-width space keeps in-flow content, preserving line box height during exits.
    const isEmptyTransition = segments.length === 0;
    if (isEmptyTransition) {
      segments = [{ id: EMPTY_ID, string: "\u200B" }];
    }

    splitWordSpans(element, splits);

    this.prevMeasures = measure(this.element);
    // Items wherever they sit — a formatted run holds its own in a real wrapper.
    const oldChildren = itemsOf(element);
    const newIds = new Set(segments.map((b) => b.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute(ATTR_ID) as string) &&
        !child.hasAttribute(ATTR_EXITING),
    );

    const exitingSet = new Set(exiting);

    // An element swapped for another is one slot changing hands, so each anchors to
    // the other. A neighbouring word would drag it the width of a word instead.
    const partners = this.pairElements(oldChildren, exitingSet, segments);
    const oldIds = oldChildren.map((c) => c.getAttribute(ATTR_ID) as string);
    const exitingAnchorId = resolveExitingAnchors(
      oldChildren,
      exitingSet,
      oldIds,
      newIds,
    );

    detachFromFlow(element, exiting);
    const formatChanges = reconcileChildren(
      element,
      oldChildren,
      newIds,
      segments,
    );

    this.currentMeasures = measure(this.element);

    // One line's worth. Without wrapping a line exists only where the value put one;
    // with it, only the boxes know, so they are asked.
    const lineCount = this.options.wrap
      ? new Set(
          Object.values(this.currentMeasures).map((at) => Math.round(at.y)),
        ).size || 1
      : segments.reduce(
          (lines, segment) => (segment.string === "\n" ? lines + 1 : lines),
          1,
        );
    const slideDistance = (element.offsetHeight || 20 * lineCount) / lineCount;

    // Measured at the old width, not derived — text-align does nothing to overflowing content.
    element.style.width = `${oldWidth}px`;
    void element.offsetWidth;
    const firstFrameMeasures = measure(this.element);
    element.style.width = "";

    this.updateStyles(segments, firstFrameMeasures, slideDistance, partners);

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
      const id = child.getAttribute(ATTR_ID) as string;
      if (this.isInitialRender || id === EMPTY_ID) {
        child.remove();
        return;
      }
      if (leavingTogether.has(child)) return;

      const partnerId = partners.get(id);
      const anchorId = partnerId ?? exitingAnchorId.get(child);
      const { dx, dy } = anchorId
        ? computeDelta(
            this.currentMeasures,
            this.prevMeasures,
            partnerId ? id : anchorId,
            anchorId,
          )
        : { dx: 0, dy: 0 };

      if (child.hasAttribute(ATTR_NODE)) {
        animateElementExit(child, {
          dx,
          dy,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else if (child.hasAttribute(ATTR_KIND)) {
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

    for (const change of formatChanges) {
      animateFormatChange(change.element, {
        from: change.from,
        duration: this.options.duration!,
        ease: this.options.ease!,
      });
    }

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
        !this.options.wrap,
      );
    }
  }

  /** Each side of an element swap, by ID, in both directions. */
  private pairElements(
    oldChildren: HTMLElement[],
    exiting: Set<HTMLElement>,
    segments: Segment[],
  ): Map<string, string> {
    // Everything an element sits among, so a swap is recognised by its position.
    const settled = oldChildren.filter(
      (child) =>
        child.hasAttribute(ATTR_NODE) && !child.hasAttribute(ATTR_EXITING),
    );
    const leaving = new Set(
      settled
        .filter((child) => exiting.has(child))
        .map((child) => child.getAttribute(ATTR_ID) as string),
    );

    return pairElementSlots(
      settled.map((child) => child.getAttribute(ATTR_ID) as string),
      segments.filter((segment) => segment.node).map((segment) => segment.id),
      (id) => leaving.has(id),
      (id) => !this.prevMeasures[id],
    );
  }

  private updateStyles(
    segments: Segment[],
    firstFrameMeasures: Measures,
    slideDistance: number,
    partners: Map<string, string>,
  ) {
    if (this.isInitialRender) return;

    const children = itemsOf(this.element);
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

      const partnerId = isNew ? partners.get(key) : undefined;
      const deltaKey = isNew
        ? (partnerId ??
          findNearestAnchor(
            segments.findIndex((b) => b.id === key),
            segmentIds,
            persistentIds,
          ))
        : key;

      const { dx: deltaX, dy: deltaY } = deltaKey
        ? computeDelta(
            this.prevMeasures,
            firstFrameMeasures,
            partnerId ? key : deltaKey,
            deltaKey,
          )
        : { dx: 0, dy: 0 };

      const kind = kinds.get(key);

      if (child.hasAttribute(ATTR_NODE) && isNew) {
        animateElementEnter(child, {
          deltaX,
          deltaY,
          duration: this.options.duration!,
          ease: this.options.ease!,
        });
      } else if (kind && isNew) {
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
