import { TextMorph } from "./index";
import type { TextMorphOptions } from "./types";

export class MorphController {
  private instance: TextMorph | null = null;
  private lastText = "";
  private configKey = "";

  attach(element: HTMLElement, options: Omit<TextMorphOptions, "element">) {
    this.instance?.destroy();
    this.instance = new TextMorph({ element, ...options });
    this.configKey = MorphController.serializeConfig(options);

    if (this.lastText) {
      this.instance.update(this.lastText);
    }
  }

  update(text: string) {
    this.lastText = text;
    this.instance?.update(text);
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
      debug: options.debug,
      disabled: options.disabled,
      respectReducedMotion: options.respectReducedMotion,
    });
  }
}
