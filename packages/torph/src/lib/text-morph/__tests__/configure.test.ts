// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import {
  TextMorph,
  MorphController,
  DEFAULT_TEXT_MORPH_OPTIONS,
} from "../index";
import type { TextMorphOptions } from "../types";
import { resolveEase } from "../../utils/spring";
import { ATTR_DEBUG, ATTR_ITEM, ATTR_SR } from "../../utils/constants";

type Timing = { duration?: unknown; easing?: unknown };

// Fades are always `linear`, so an ease under test must be something else.

const timings: Timing[] = [];
let destroy: MockInstance;
const mounted: TextMorph[] = [];

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
  destroy = vi.spyOn(TextMorph.prototype, "destroy");
});

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  destroy.mockClear();
  timings.length = 0;
  document.body.innerHTML = "";
});

function mount(options: Partial<TextMorphOptions> = {}) {
  const element = document.createElement("span");
  document.body.appendChild(element);
  // Pinned off unless a test turns it on, so the environment's query can't decide the outcome.
  const morph = new TextMorph({
    element,
    respectReducedMotion: false,
    ...options,
  });
  mounted.push(morph);
  return { element, morph };
}

/** The animate() timings of one morph. */
function morphed(morph: TextMorph, from: string, to: string) {
  morph.update(from);
  timings.length = 0;
  morph.update(to);
  return {
    durations: new Set(timings.map((t) => t.duration)),
    easings: new Set(timings.map((t) => t.easing)),
  };
}

/** A matchMedia stand-in that holds its listeners where a test can count them. */
function fakeReducedMotion() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: false,
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
      listeners.add(fn),
    removeEventListener: (
      _: string,
      fn: (event: MediaQueryListEvent) => void,
    ) => listeners.delete(fn),
  };
  const original = window.matchMedia;
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    listeners,
    emit(matches: boolean) {
      query.matches = matches;
      listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent));
    },
    restore: () => (window.matchMedia = original),
  };
}

const items = (element: HTMLElement) =>
  element.querySelectorAll(`[${ATTR_ITEM}]`).length;

describe("configure", () => {
  it("keeps the instance and its DOM whichever option changes", () => {
    const changes: Partial<TextMorphOptions>[] = [
      { duration: 900 },
      { ease: "ease-in" },
      { ease: { stiffness: 200, damping: 20 } },
      { locale: "de" },
      { scale: false },
      { numbers: false },
      { decimals: 2 },
      { debug: true },
      { disabled: true },
      { respectReducedMotion: true },
      { onAnimationStart: () => {} },
    ];
    for (const change of changes) {
      const { element, morph } = mount();
      morph.update("hello");
      const sr = element.querySelector(`[${ATTR_SR}]`);
      morph.configure(change);
      expect(destroy, JSON.stringify(change)).not.toHaveBeenCalled();
      expect(element.querySelector(`[${ATTR_SR}]`)).toBe(sr);
    }
  });

  it("morphs the next update with the new duration and ease", () => {
    const { morph } = mount();
    morph.configure({ duration: 900, ease: "ease-in-out" });

    const { durations, easings } = morphed(morph, "hello", "hello world");
    expect(durations).toContain(900);
    expect(durations).not.toContain(DEFAULT_TEXT_MORPH_OPTIONS.duration);
    expect(easings).toContain("ease-in-out");
    expect(easings).not.toContain(DEFAULT_TEXT_MORPH_OPTIONS.ease);
  });

  it("resolves a spring as the constructor does", () => {
    const params = { stiffness: 200, damping: 20 };
    const { ease, duration } = resolveEase(params, 0);
    const { morph } = mount({ duration: 900 });
    morph.configure({ ease: params });

    const { durations, easings } = morphed(morph, "hello", "hello world");
    expect(durations).toContain(duration);
    expect(durations).not.toContain(900);
    expect(easings).toContain(ease);
  });

  it("keeps options it isn't given, and defaults ones given as undefined", () => {
    const { morph } = mount({ duration: 900, ease: "ease-in" });
    morph.configure({ duration: undefined });

    const { durations, easings } = morphed(morph, "hello", "hello world");
    expect(durations).toContain(DEFAULT_TEXT_MORPH_OPTIONS.duration);
    expect(durations).not.toContain(900);
    expect(easings).toContain("ease-in");
  });

  it("takes the disabled path on the next update, and leaves it again", () => {
    const { element, morph } = mount();
    morph.update("hello");
    morph.configure({ disabled: true });

    timings.length = 0;
    morph.update("hello world");
    expect(element.textContent).toBe("hello world");
    expect(element.children.length).toBe(0);
    expect(timings).toEqual([]);

    morph.configure({ disabled: false });
    morph.update("hello there");
    morph.update("hello again");
    expect(timings.length).toBeGreaterThan(0);
    expect(items(element)).toBeGreaterThan(0);
  });

  it("sets up an instance built disabled once it is enabled", () => {
    const { element, morph } = mount({ disabled: true });
    morph.update("hello");
    morph.configure({ disabled: false });
    morph.update("hello world");
    expect(element.querySelector(`[${ATTR_SR}]`)?.textContent).toBe(
      "hello world",
    );
  });

  it("toggles the debug outline", () => {
    const { element, morph } = mount();
    morph.update("hello");
    morph.configure({ debug: true });
    expect(element.hasAttribute(ATTR_DEBUG)).toBe(true);
    morph.configure({ debug: false });
    expect(element.hasAttribute(ATTR_DEBUG)).toBe(false);
  });

  it("adds and removes the reduced-motion listener", () => {
    const media = fakeReducedMotion();
    try {
      const { element, morph } = mount();
      expect(media.listeners.size).toBe(0);

      morph.configure({ respectReducedMotion: true });
      morph.configure({ respectReducedMotion: true });
      expect(media.listeners.size).toBe(1);

      morph.update("hello");
      media.emit(true);
      morph.update("hello world");
      expect(element.textContent).toBe("hello world");
      expect(element.children.length).toBe(0);

      morph.configure({ respectReducedMotion: false });
      expect(media.listeners.size).toBe(0);
      morph.update("hello there");
      morph.update("hello again");
      expect(items(element)).toBeGreaterThan(0);

      morph.configure({ respectReducedMotion: true });
      expect(media.listeners.size).toBe(1);
      morph.destroy();
      mounted.pop();
      expect(media.listeners.size).toBe(0);
    } finally {
      media.restore();
    }
  });
});

describe("MorphController.configure", () => {
  function attached(options: Partial<TextMorphOptions> = {}) {
    const element = document.createElement("span");
    document.body.appendChild(element);
    const controller = new MorphController();
    controller.attach(element, { respectReducedMotion: false, ...options });
    return { element, controller };
  }

  it("reaches the live morph without rebuilding it", async () => {
    const { controller } = attached();
    controller.update("hello");
    await Promise.resolve();

    controller.configure({ respectReducedMotion: false, duration: 900 });
    timings.length = 0;
    controller.update("hello world");
    await Promise.resolve();

    expect(destroy).not.toHaveBeenCalled();
    expect(timings.map((t) => t.duration)).toContain(900);
    controller.destroy();
  });

  it("formats the current number again for a new locale", async () => {
    const { element, controller } = attached({ locale: "en" });
    const sr = () => element.querySelector(`[${ATTR_SR}]`)?.textContent;
    controller.update(1234.5);
    await Promise.resolve();
    expect(sr()).toBe("1,234.5");

    controller.configure({ respectReducedMotion: false, locale: "de" });
    await Promise.resolve();
    expect(sr()).toBe("1.234,5");
    expect(destroy).not.toHaveBeenCalled();
    controller.destroy();
  });
});
