import { TextMorph } from "./index";
import type { TextMorphOptions } from "./types";
import { type ContentPart, flattenContent } from "./utils/content";

export class MorphController {
  private instance: TextMorph | null = null;
  // Flattened on the way in: the engine adopts an element source's children, so
  // re-reading one on a later re-attach would find it empty.
  private lastText: string | number | ContentPart[] = "";
  private lastCursorIndex?: number;
  private configKey = "";

  attach(element: HTMLElement, options: Omit<TextMorphOptions, "element">) {
    this.instance?.destroy();
    this.instance = new TextMorph({ element, ...options });
    this.configKey = MorphController.serializeConfig(options);

    if (this.lastText !== "") {
      this.instance.update(this.lastText, this.lastCursorIndex);
    }
  }

  update(
    value: Element | string | number | ContentPart[],
    cursorIndex?: number,
  ) {
    const text =
      typeof value === "object" && !Array.isArray(value)
        ? flattenContent(value)
        : value;
    this.lastText = text;
    this.lastCursorIndex = cursorIndex;
    this.instance?.update(text, cursorIndex);
  }

  needsRecreate(options: Omit<TextMorphOptions, "element">): boolean {
    return MorphController.serializeConfig(options) !== this.configKey;
  }

  destroy() {
    this.instance?.destroy();
    this.instance = null;
  }

  static serializeConfig(options: Omit<TextMorphOptions, "element">): string {
    return JSON.stringify({
      ease: options.ease,
      duration: options.duration,
      locale: options.locale,
      scale: options.scale,
      numbers: options.numbers,
      wrap: options.wrap,
      decimals: options.decimals,
      debug: options.debug,
      disabled: options.disabled,
      respectReducedMotion: options.respectReducedMotion,
    });
  }
}
