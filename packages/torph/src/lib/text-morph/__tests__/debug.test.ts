// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TextMorph } from "../index";
import { guarded } from "../../../debug/guard";
import { enableDebug } from "../../../debug";

// As in engine.test.ts: happy-dom rejects a cancelled animation's `finished` for real.
beforeAll(() => {
  const original = Element.prototype.animate;
  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    const animation = original.call(this, keyframes as never, options as never);
    animation.finished?.catch(() => {});
    return animation;
  } as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("guarded", () => {
  it("names the hook that read layout, once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const element = document.createElement("span");
    guarded("test.kinds.digit.enter", () => {
      element.getBoundingClientRect();
      void element.offsetWidth;
      getComputedStyle(element);
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("test.kinds.digit.enter");
    expect(warn.mock.calls[0]![0]).toContain("getBoundingClientRect");
  });

  it("leaves reads outside the hook alone, and puts every API back", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rect = Element.prototype.getBoundingClientRect;
    const style = globalThis.getComputedStyle;
    const offset = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );
    guarded("test.prepare", () => {});
    expect(Element.prototype.getBoundingClientRect).toBe(rect);
    expect(globalThis.getComputedStyle).toBe(style);
    expect(
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
    ).toEqual(offset);
    document.createElement("span").getBoundingClientRect();
    expect(warn).not.toHaveBeenCalled();
  });

  it("puts every API back when the hook throws", () => {
    const rect = Element.prototype.getBoundingClientRect;
    expect(() =>
      guarded("test.throws", () => {
        throw new Error("hook");
      }),
    ).toThrow("hook");
    expect(Element.prototype.getBoundingClientRect).toBe(rect);
  });
});

describe("the built-in plugins under debug", () => {
  beforeAll(enableDebug);

  it("never read inside a hook", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const element = document.createElement("span");
    document.body.appendChild(element);
    const morph = new TextMorph({
      element,
      debug: true,
      respectReducedMotion: false,
    });
    // Numbers through every hook, a run long enough to group, and interrupts.
    for (const value of [
      "$1,234",
      "$9,876.50",
      "abcdefghijklmnop",
      "abcmnopqrstuvwx",
      "Total 42",
      "Total 1,042",
      "",
      "$7",
    ]) {
      morph.update(value);
    }
    morph.destroy();
    expect(warn).not.toHaveBeenCalled();
  });
});
