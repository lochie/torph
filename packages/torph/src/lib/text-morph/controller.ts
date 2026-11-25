import { TextMorph } from "./index";
import type { TextMorphOptions } from "./types";

export class MorphController {
  private instance: TextMorph | null = null;
  private lastText: string | number = "";
  private lastCursorIndex?: number;

  attach(element: HTMLElement, options: Omit<TextMorphOptions, "element">) {
    this.instance?.destroy();
    this.instance = new TextMorph({ element, ...options });

    if (this.lastText !== "") {
      this.instance.update(this.lastText, this.lastCursorIndex);
    }
  }

  update(text: string | number, cursorIndex?: number) {
    this.lastText = text;
    this.lastCursorIndex = cursorIndex;
    // Queued, so every instance a render updates shares one layout pass.
    this.instance?.queue(text, cursorIndex);
  }

  configure(options: Omit<TextMorphOptions, "element">) {
    this.instance?.configure(options);
    // A new `locale` or `decimals` formats the same number differently.
    if (this.lastText !== "") {
      this.instance?.queue(this.lastText, this.lastCursorIndex);
    }
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
      decimals: options.decimals,
      debug: options.debug,
      disabled: options.disabled,
      respectReducedMotion: options.respectReducedMotion,
    });
  }
}
