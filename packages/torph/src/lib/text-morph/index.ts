import type { TextMorphOptions } from "./types";
import { type Block, segmentText } from "./utils/segment";
import {
  type Measures,
  measure,
  computeDelta,
  findNearestAnchor,
} from "./utils/flip";
import {
  animateExit,
  animateEnterOrPersist,
  transitionContainerSize,
} from "./utils/animate";
import { addStyles, removeStyles } from "./utils/styles";

export type { TextMorphOptions } from "./types";

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
  private options: Omit<TextMorphOptions, "element"> = {};

  private data: HTMLElement | string;

  private currentMeasures: Measures = {};
  private prevMeasures: Measures = {};
  private isInitialRender = true;
  private prefersReducedMotion = false;
  private mediaQuery?: MediaQueryList;


  constructor(options: TextMorphOptions) {
    this.options = {
      ...DEFAULT_TEXT_MORPH_OPTIONS,
      ...options,
    };

    this.element = options.element;

    // reduced motion detection
    if (typeof window !== "undefined" && this.options.respectReducedMotion) {
      this.mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefersReducedMotion = this.mediaQuery.matches;
      this.mediaQuery.addEventListener("change", this.handleMediaQueryChange);
    }

    if (!this.isDisabled()) {
      this.element.setAttribute("torph-root", "");
      this.element.style.transitionDuration = `${this.options.duration}ms`;
      this.element.style.transitionTimingFunction = this.options.ease!;

      if (options.debug) this.element.setAttribute("torph-debug", "");
    }

    this.data = "";
    if (!this.isDisabled()) {
      addStyles();
    }
  }

  destroy() {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener(
        "change",
        this.handleMediaQueryChange,
      );
    }
    this.element.getAnimations().forEach((anim) => anim.cancel());
    this.element.removeAttribute("torph-root");
    this.element.removeAttribute("torph-debug");
    removeStyles();
  }

  private handleMediaQueryChange = (event: MediaQueryListEvent) => {
    this.prefersReducedMotion = event.matches;
  };

  private isDisabled(): boolean {
    return Boolean(
      this.options.disabled ||
        (this.options.respectReducedMotion && this.prefersReducedMotion),
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
    const oldWidth = element.offsetWidth;
    const oldHeight = element.offsetHeight;

    const blocks = segmentText(value, this.options.locale!);

    this.prevMeasures = measure(this.element);
    const oldChildren = Array.from(element.children) as HTMLElement[];
    const newIds = new Set(blocks.map((b) => b.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute("torph-id") as string) &&
        !child.hasAttribute("torph-exiting"),
    );

    // For each exiting char, find the nearest persistent neighbor in old order
    const exitingSet = new Set(exiting);
    const oldIds = oldChildren.map(
      (c) => c.getAttribute("torph-id") as string,
    );
    const persistentOldIds = new Set(
      oldIds.filter(
        (id, i) => newIds.has(id) && !exitingSet.has(oldChildren[i]!),
      ),
    );

    const exitingAnchorId = new Map<HTMLElement, string | null>();
    for (let i = 0; i < oldChildren.length; i++) {
      const child = oldChildren[i]!;
      if (!exitingSet.has(child)) continue;
      exitingAnchorId.set(
        child,
        findNearestAnchor(i, oldIds, persistentOldIds, "forward-first"),
      );
    }

    // Two-pass: read all positions before modifying any element,
    // since setting position:absolute removes from flow and shifts siblings
    const exitPositions = exiting.map((child) => {
      child.getAnimations().forEach((a) => a.cancel());
      return {
        left: child.offsetLeft,
        top: child.offsetTop,
        width: child.offsetWidth,
        height: child.offsetHeight,
      };
    });
    exiting.forEach((child, i) => {
      const pos = exitPositions[i]!;
      child.setAttribute("torph-exiting", "");
      child.style.position = "absolute";
      child.style.pointerEvents = "none";
      child.style.left = `${pos.left}px`;
      child.style.top = `${pos.top}px`;
      child.style.width = `${pos.width}px`;
      child.style.height = `${pos.height}px`;
    });

    oldChildren.forEach((child) => {
      const id = child.getAttribute("torph-id") as string;
      if (newIds.has(id)) child.remove();
    });

    // Disabled-mode updates set plain text via textContent; remove that text node
    // before appending torph items so old content is not duplicated.
    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.remove();
      }
    });

    blocks.forEach((block) => {
      const span = document.createElement("span");
      span.setAttribute("torph-item", "");
      span.setAttribute("torph-id", block.id);
      span.textContent = block.string;
      element.appendChild(span);
    });

    this.currentMeasures = measure(this.element);
    this.updateStyles(blocks);

    exiting.forEach((child) => {
      if (this.isInitialRender) {
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

    if (this.isInitialRender) {
      this.isInitialRender = false;
      element.style.width = "auto";
      element.style.height = "auto";
      return;
    }

    transitionContainerSize(
      element,
      oldWidth,
      oldHeight,
      this.options.duration!,
      this.options.onAnimationComplete,
    );
  }

  private updateStyles(blocks: Block[]) {
    if (this.isInitialRender) return;

    const children = Array.from(this.element.children) as HTMLElement[];
    const blockIds = blocks.map((b) => b.id);

    const persistentIds = new Set(
      blockIds.filter((id) => this.prevMeasures[id]),
    );

    children.forEach((child, index) => {
      if (child.hasAttribute("torph-exiting")) return;
      const key = child.getAttribute("torph-id") || `child-${index}`;
      const isNew = !this.prevMeasures[key];

      const deltaKey = isNew
        ? findNearestAnchor(
            blocks.findIndex((b) => b.id === key),
            blockIds,
            persistentIds,
          )
        : key;

      const { dx: deltaX, dy: deltaY } = deltaKey
        ? computeDelta(this.prevMeasures, this.currentMeasures, deltaKey)
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
