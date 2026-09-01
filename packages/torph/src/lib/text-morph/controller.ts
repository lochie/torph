import { TextMorph } from "./index";
import type { TextMorphOptions } from "./types";

export class MorphController {
  private instance: TextMorph | null = null;
  private lastText: string | number = "";
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

  update(text: string | number, cursorIndex?: number) {
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
      decimals: options.decimals,
      debug: options.debug,
      disabled: options.disabled,
      respectReducedMotion: options.respectReducedMotion,
    });
  }
}
