import type { TextMorphOptions } from "./types";

export { TextMorphOptions } from "./types";

type Block = {
  id: string;
  string: string;
};
type Measures = {
  [key: string]: { x: number; y: number };
};

export class TextMorph {
  private element: HTMLElement;
  private options: Omit<TextMorphOptions, "element"> = {};

  private data: HTMLElement | string;

  private currentMeasures: Measures = {};
  private prevMeasures: Measures = {};

  static styleEl: HTMLStyleElement;

  constructor(options: TextMorphOptions) {
    this.options = {
      locale: "en",
      duration: 400,
      ease: "cubic-bezier(0.19, 1, 0.22, 1)",
      ...options,
    };

    this.element = options.element;
    this.element.setAttribute("torph-root", "");
    this.element.style.transitionDuration = `${this.options.duration}ms`;
    this.element.style.transitionTimingFunction = this.options.ease!;

    if (options.debug) this.element.setAttribute("torph-debug", "");

    this.data = this.element.innerHTML;

    this.addStyles();
  }

  destroy() {
    this.element.getAnimations().forEach((anim) => anim.cancel());
    this.element.removeAttribute("torph-root");
    this.element.removeAttribute("torph-debug");
    this.removeStyles();
  }

  update(value: HTMLElement | string) {
    if (value === this.data) return;
    this.data = value;

    if (this.data instanceof HTMLElement) {
      // TODO: handle HTMLElement case
      throw new Error("HTMLElement not yet supported");
    } else {
      this.createTextGroup(this.data, this.element);
    }
  }

  private createTextGroup(value: string, element: HTMLElement) {
    const oldWidth = element.offsetWidth;
    const oldHeight = element.offsetHeight;

    const byWord = value.includes(" ");
    const segmenter = new Intl.Segmenter(this.options.locale, {
      granularity: byWord ? "word" : "grapheme",
    });
    const iterator = segmenter.segment(value)[Symbol.iterator]();
    const blocks = this.blocks(iterator);

    this.prevMeasures = this.measure();
    const oldChildren = Array.from(element.children) as HTMLElement[];
    const newIds = new Set(blocks.map((b) => b.id));

    const exiting = oldChildren.filter(
      (child) =>
        !newIds.has(child.getAttribute("torph-id") as string) &&
        !child.hasAttribute("torph-exiting"),
    );

    const parentRect = this.getUnscaledBoundingClientRect(element);
    exiting.forEach((child) => {
      const rect = this.getUnscaledBoundingClientRect(child);
      child.setAttribute("torph-exiting", "");
      child.style.position = "absolute";
      child.style.pointerEvents = "none";
      child.style.left = `${rect.left - parentRect.left}px`;
      child.style.top = `${rect.top - parentRect.top}px`;
      child.style.width = `${rect.width}px`;
      child.style.height = `${rect.height}px`;
    });

    oldChildren.forEach((child) => {
      const id = child.getAttribute("torph-id") as string;
      if (newIds.has(id)) child.remove();
    });

    blocks.forEach((block) => {
      const span = document.createElement("span");
      span.setAttribute("torph-item", "");
      span.setAttribute("torph-id", block.id);
      span.textContent = block.string;
      element.appendChild(span);
    });

    this.currentMeasures = this.measure();
    this.updateStyles();

    exiting.forEach((child) => {
      const id = child.getAttribute("torph-id")!;

      const prev = this.prevMeasures[id];

      const siblings = Array.from(element.children) as HTMLElement[];
      const nearest = siblings.find((s) => {
        const sRect = s.getBoundingClientRect();
        const cRect = child.getBoundingClientRect();
        return Math.abs(sRect.left - cRect.left) < 40;
      });

      const nextPos = nearest
        ? this.currentMeasures[nearest.getAttribute("torph-id")!]
        : prev;

      const dx = (nextPos ? nextPos.x - (prev?.x || 0) : 0) * 0.5;
      const dy = (nextPos ? nextPos.y - (prev?.y || 0) : 0) * 0.5;

      child.getAnimations().forEach((a) => a.cancel());
      const animation: Animation = child.animate(
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.95)`,
          opacity: 0,
          offset: 1,
        },
        {
          duration: this.options.duration,
          easing: this.options.ease,
          fill: "both",
        },
      );
      animation.onfinish = () => child.remove();
    });

    if (oldWidth === 0 || oldHeight === 0) return;

    element.style.width = "auto";
    element.style.height = "auto";
    void element.offsetWidth; // force reflow

    const newWidth = element.offsetWidth;
    const newHeight = element.offsetHeight;

    element.style.width = `${oldWidth}px`;
    element.style.height = `${oldHeight}px`;
    void element.offsetWidth; // force reflow

    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;

    // TODO: move to `transitionend` event listener
    setTimeout(() => {
      element.style.width = "auto";
      element.style.height = "auto";
    }, this.options.duration);
  }

  private measure() {
    const children = Array.from(this.element.children) as HTMLElement[];
    const measures: Measures = {};

    children.forEach((child, index) => {
      if (child.hasAttribute("torph-exiting")) return;
      const key = child.getAttribute("torph-id") || `child-${index}`;
      measures[key] = {
        x: child.offsetLeft,
        y: child.offsetTop,
      };
    });

    return measures;
  }

  private updateStyles() {
    const children = Array.from(this.element.children) as HTMLElement[];

    children.forEach((child, index) => {
      if (child.hasAttribute("torph-exiting")) return;
      const key = child.getAttribute("torph-id") || `child-${index}`;
      const prev = this.prevMeasures[key];
      const current = this.currentMeasures[key];

      const cx = current?.x || 0;
      const cy = current?.y || 0;

      const deltaX = prev ? prev?.x - cx : 0;
      const deltaY = prev ? prev?.y - cy : 0;
      const isNew = !prev;

      child.getAnimations().forEach((a) => a.cancel());
      child.animate(
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${isNew ? 0.95 : 1})`,
          opacity: isNew ? 0 : 1,
          offset: 0,
        },
        {
          duration: this.options.duration,
          easing: this.options.ease,
          delay: isNew ? this.options.duration! * 0.2 : 0,
          fill: "both",
        },
      );
    });
  }

  private addStyles() {
    if (TextMorph.styleEl) return;

    const style = document.createElement("style");
    style.dataset.torph = "true";
    style.innerHTML = `
[torph-root] {
  display: inline-flex; /* TODO: remove for multi-line support */
  position: relative;
  will-change: width, height;
  transition-property: width, height;
}

[torph-item] {
  display: inline-block;
  will-change: opacity, transform;
  transform: none;
  opacity: 1;
}
  
[torph-root][torph-debug] {
  outline:2px solid magenta;
  [torph-item] {
    outline:2px solid cyan;
    outline-offset: -4px;
  }
}
  `;
    document.head.appendChild(style);
    TextMorph.styleEl = style;
  }

  private removeStyles() {
    if (TextMorph.styleEl) {
      TextMorph.styleEl.remove();
      TextMorph.styleEl = undefined!;
    }
  }

  // utils

  private blocks(iterator: Intl.SegmentIterator<Intl.SegmentData>) {
    const uniqueStrings: Block[] = Array.from(iterator).reduce(
      (acc, string) => {
        if (string.segment === " ") {
          return [...acc, { id: `space-${string.index}`, string: "\u00A0" }];
        }

        const existingString = acc.find((x) => x.string === string.segment);
        if (existingString) {
          return [
            ...acc,
            { id: `${string.segment}-${string.index}`, string: string.segment },
          ];
        }

        return [
          ...acc,
          {
            id: string.segment,
            string: string.segment,
          },
        ];
      },
      [] as Block[],
    );

    return uniqueStrings;
  }

  private getUnscaledBoundingClientRect(element: HTMLElement) {
    const scaledRect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const transform = computedStyle.transform;

    let scaleX = 1;
    let scaleY = 1;

    const matrixRegex = /matrix\(([^)]+)\)/;
    const match = transform.match(matrixRegex);

    if (match) {
      const values = match[1]?.split(",").map(Number);
      if (values && values?.length >= 4) {
        scaleX = values[0]!;
        scaleY = values[3]!;
      }
    } else {
      const scaleXMatch = transform.match(/scaleX\(([^)]+)\)/);
      const scaleYMatch = transform.match(/scaleY\(([^)]+)\)/);
      if (scaleXMatch) scaleX = parseFloat(scaleXMatch[1]!);
      if (scaleYMatch) scaleY = parseFloat(scaleYMatch[1]!);
    }

    const unscaledWidth = scaledRect.width / scaleX;
    const unscaledHeight = scaledRect.height / scaleY;

    const unscaledX = scaledRect.x + (scaledRect.width - unscaledWidth) / 2;
    const unscaledY = scaledRect.y + (scaledRect.height - unscaledHeight) / 2;

    return {
      x: unscaledX,
      y: unscaledY,
      width: unscaledWidth,
      height: unscaledHeight,
      top: unscaledY,
      right: unscaledX + unscaledWidth,
      bottom: unscaledY + unscaledHeight,
      left: unscaledX,
    };
  }

  private log(...args: any[]) {
    if (this.options.debug) console.log("[TextMorph]", ...args);
  }
}
