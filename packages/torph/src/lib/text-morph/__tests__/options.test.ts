// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { TextMorph, DEFAULT_TEXT_MORPH_OPTIONS } from "../index";
import type { TextMorphOptions } from "../types";

type Timing = { duration?: unknown; easing?: unknown };

const timings: Timing[] = [];

beforeAll(() => {
  const original = Element.prototype.animate;
  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    timings.push((options ?? {}) as Timing);
    const animation = original.call(this, keyframes as never, options as never);
    animation.finished?.catch(() => {});
    return animation;
  } as typeof Element.prototype.animate;
});

afterEach(() => {
  timings.length = 0;
  document.body.innerHTML = "";
});

function spin(options: Partial<TextMorphOptions> = {}) {
  const element = document.createElement("span");
  document.body.appendChild(element);
  const morph = new TextMorph({
    element,
    respectReducedMotion: false,
    ...options,
  });

  // Across a digit-count change, which is what puts characters on the slide path.
  for (const value of [0, 9, 10, 99, 100, 101, 9, 0]) morph.update(`$${value}`);
  morph.destroy();
}

/**
 * A prop left off in JSX arrives as an explicit `undefined`. Spread over the defaults
 * it used to win, and the fades derive their own length from it — `undefined * 0.45`
 * is NaN, which animate() rejects outright.
 */
describe("options given as undefined", () => {
  it("falls back to the defaults rather than overwriting them", () => {
    spin({ duration: undefined, ease: undefined });

    const durations = new Set(timings.map((t) => t.duration));
    for (const duration of durations) {
      expect(duration, `duration ${duration}`).toBeTypeOf("number");
      expect(Number.isFinite(duration as number)).toBe(true);
      expect(duration as number).toBeGreaterThanOrEqual(0);
    }
    expect(durations).toContain(DEFAULT_TEXT_MORPH_OPTIONS.duration);
    expect(new Set(timings.map((t) => t.easing))).toContain(
      DEFAULT_TEXT_MORPH_OPTIONS.ease,
    );
  });

  it("still takes the values that were given", () => {
    spin({ duration: 600, ease: "ease-in-out" });

    expect(new Set(timings.map((t) => t.duration))).toContain(600);
    expect(new Set(timings.map((t) => t.easing))).toContain("ease-in-out");
  });
});
