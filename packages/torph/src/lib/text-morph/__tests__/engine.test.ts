// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { TextMorph } from "../index";
import type { TextMorphOptions } from "../types";
import { ATTR_EXITING, ATTR_ID, ATTR_KIND } from "../../utils/constants";

// The segmentation and diff suites assert what a morph *should* be. This one
// asserts what the engine does with that: which of the two animation families
// each character is handed to, and whether the root is masked while any of them
// is sliding. Nothing here needs real geometry — happy-dom reports every rect as
// zero, which pins every FLIP delta to zero and leaves the slide offsets as the
// only motion in the transforms. That is exactly the part under test.

const SLIDE = 20; // `offsetHeight || 20` — happy-dom has no layout

/**
 * The engine cancels animations constantly — every interrupted morph does. A
 * browser leaves the `finished` promise of a cancelled animation internally
 * handled; happy-dom rejects it for real, so without this every cancel lands as
 * an unhandled AbortError and buries the actual output.
 */
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

type Recorded = { id: string | null; keyframes: unknown; options: unknown };

function recordAnimations() {
  const calls: Recorded[] = [];
  const original = Element.prototype.animate;

  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    calls.push({ id: this.getAttribute(ATTR_ID), keyframes, options });
    return original.call(this, keyframes as never, options as never);
  } as typeof Element.prototype.animate;

  return { calls, restore: () => (Element.prototype.animate = original) };
}

type Frame = { transform?: string; opacity?: number; offset?: number };

/**
 * The transform an element was given, flattened to one comparable string.
 *
 * The two families are distinguishable by shape alone: a slide is a single
 * keyframe pinned to one end of the timeline, a text morph is a pair walking
 * from an offset to `none`.
 */
function motion(calls: Recorded[], id: string): string | null {
  const call = calls.find((c) => {
    if (c.id !== id) return false;
    const frames = (Array.isArray(c.keyframes) ? c.keyframes : [c.keyframes]) as Frame[];
    return frames.some((frame) => frame.transform !== undefined);
  });
  if (!call) return null;

  if (Array.isArray(call.keyframes)) {
    const [from, to] = call.keyframes as Frame[];
    return `${from!.transform} → ${to!.transform}`;
  }
  const frame = call.keyframes as Frame;
  return `${frame.transform} @${frame.offset}`;
}

const slideFrom = (dy: number) => `translate(0px, ${dy}px) @0`;
const slideOut = `translate(0px, ${SLIDE}px) @1`;
const textEnter = "translate(0px, 0px) scale(0.95) → none";
const textPersist = "translate(0px, 0px) scale(1) → none";
const textExit = "translate(0px, 0px) scale(0.95) @1";

type Child = { id: string; text: string; kind: string | null; exiting: boolean };

function children(element: HTMLElement): Child[] {
  return Array.from(element.children).map((child) => ({
    id: child.getAttribute(ATTR_ID)!,
    text: child.textContent ?? "",
    kind: child.getAttribute(ATTR_KIND),
    exiting: child.hasAttribute(ATTR_EXITING),
  }));
}

const live = (element: HTMLElement) => children(element).filter((c) => !c.exiting);
const leaving = (element: HTMLElement) => children(element).filter((c) => c.exiting);

/** What the root reads as, ignoring the characters on their way out. */
const rendered = (element: HTMLElement) =>
  live(element)
    .map((c) => c.text.replace(/\u00A0/g, " "))
    .join("");

const shape = (element: HTMLElement) =>
  live(element).map((c) => `${c.text}:${c.kind ?? "text"}`);

const idOf = (element: HTMLElement, text: string) =>
  live(element).find((c) => c.text === text)!.id;

const mounted: TextMorph[] = [];

function mount(options: Partial<TextMorphOptions> = {}) {
  const element = document.createElement("span");
  document.body.appendChild(element);
  // Pinned off: the listener would otherwise decide the outcome from the
  // environment's media query rather than from the value under test.
  const morph = new TextMorph({
    element,
    respectReducedMotion: false,
    ...options,
  });
  mounted.push(morph);
  return { element, morph };
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  document.body.innerHTML = "";
});

describe("kinds reach the DOM", () => {
  it("marks digits and the symbols around them, and nothing else", () => {
    const { element, morph } = mount();
    morph.update("$1,234");

    expect(shape(element)).toEqual([
      "$:symbol",
      "1:digit",
      ",:symbol",
      "2:digit",
      "3:digit",
      "4:digit",
    ]);
  });

  it("leaves a sentence's words alone", () => {
    const { element, morph } = mount();
    morph.update("3 unread messages");

    expect(shape(element)).toEqual([
      "3:digit",
      " :text",
      "unread:text",
      " :text",
      "messages:text",
    ]);
  });
});

describe("animation dispatch", () => {
  it("slides a new digit down and a new symbol up", () => {
    const { element, morph } = mount();
    morph.update("1234");

    const { calls, restore } = recordAnimations();
    morph.update("1,234");
    restore();

    const comma = idOf(element, ",");
    const leading = live(element)[0]!.id;

    // Digits arrive from above and symbols from below, so a separator appearing
    // between them reads as a different event from the digit that displaced it.
    expect(motion(calls, leading)).toBe(slideFrom(-SLIDE));
    expect(motion(calls, comma)).toBe(slideFrom(SLIDE));
  });

  it("leaves a digit that held its place untouched", () => {
    const { element, morph } = mount();
    morph.update("1234");
    const held = live(element).map((c) => c.id).slice(1);

    const { calls, restore } = recordAnimations();
    morph.update("1,234");
    restore();

    // Place matching keeps 2, 3 and 4 in their columns. With no delta to
    // correct, animating them at all would be motion the number does not have.
    for (const id of held) expect(motion(calls, id)).toBeNull();
  });

  it("sends words through the text morph, not the slide", () => {
    const { element, morph } = mount();
    morph.update("hello world");

    const { calls, restore } = recordAnimations();
    morph.update("hello there");
    restore();

    expect(motion(calls, idOf(element, "hello"))).toBe(textPersist);
    expect(motion(calls, idOf(element, "there"))).toBe(textEnter);
  });

  it("dispatches exits on the kind the element left with", () => {
    const { element, morph } = mount();
    morph.update("$5 hello");
    const digit = idOf(element, "5");
    const word = idOf(element, "hello");

    const { calls, restore } = recordAnimations();
    morph.update("$5");
    restore();

    expect(leaving(element).map((c) => c.text)).toContain("hello");
    expect(motion(calls, word)).toBe(textExit);
    expect(motion(calls, digit)).toBeNull(); // held its place, never left
  });

  it("slides a departing digit out", () => {
    const { element, morph } = mount();
    morph.update("42");
    const digits = live(element).map((c) => c.id);

    const { calls, restore } = recordAnimations();
    morph.update("hello");
    restore();

    for (const id of digits) expect(motion(calls, id)).toBe(slideOut);
  });
});

describe("the block-axis mask", () => {
  it("is installed only once a value holds a number, and held until it stops", () => {
    const { element, morph } = mount();

    morph.update("hello");
    expect(element.style.overflowY).toBe("");
    expect(element.style.getPropertyValue("mask-image")).toBe("");

    morph.update("5 apples");
    expect(element.style.overflowY).toBe("clip");
    expect(element.style.getPropertyValue("mask-image")).toContain("--torph-fade");

    // The digit is mid-exit on this update — dropping the mask now would let it
    // slide out in full view.
    morph.update("hello");
    expect(element.style.overflowY).toBe("clip");

    morph.update("goodbye");
    expect(element.style.overflowY).toBe("");
    expect(element.style.getPropertyValue("mask-image")).toBe("");
  });

  it("is cleared on destroy", () => {
    const { element, morph } = mount();
    morph.update("$5");
    expect(element.style.overflowY).toBe("clip");

    morph.destroy();
    mounted.pop();

    expect(element.style.overflowY).toBe("");
    expect(element.style.getPropertyValue("mask-image")).toBe("");
  });
});

describe("opting out", () => {
  it("numbers: false leaves digits as text and never masks", () => {
    const { element, morph } = mount({ numbers: false });
    morph.update("hello");
    morph.update("$1,234");

    expect(shape(element).every((entry) => entry.endsWith(":text"))).toBe(true);
    expect(element.style.overflowY).toBe("");
  });

  it("a multi-line value falls back to text", () => {
    const { element, morph } = mount();
    morph.update("Total");
    morph.update("Total\n1,234");

    expect(shape(element).some((entry) => entry.includes(":digit"))).toBe(false);
    expect(element.style.overflowY).toBe("");
  });
});

describe("numeric values", () => {
  it("formats through locale and decimals", () => {
    const { element, morph } = mount({ locale: "en", decimals: 2 });
    morph.update(1234.5);

    expect(rendered(element)).toBe("1,234.50");
  });

  it("takes a caret for a value that is a single number", () => {
    const { element, morph } = mount();
    morph.update("$4");
    const dollar = idOf(element, "$");
    const four = idOf(element, "4");

    // Typing "2" after the 4: place matching would read the 4 as having changed
    // magnitude, the caret says it simply stayed where it was.
    morph.update("$42", 3);

    const after = live(element);
    expect(after.map((c) => c.id)).toEqual([dollar, four, after[2]!.id]);
    expect(rendered(element)).toBe("$42");
  });
});

describe("invariants across a chained morph", () => {
  it("never gives two live children the same ID, and always renders the value", () => {
    const { element, morph } = mount();
    const sequence = [
      "$4",
      "$",
      "$420",
      "$4,020",
      "hello world",
      "3 unread messages",
      "13 unread items",
      "Total\n1,234",
      "0",
      "1,000,000",
      "it cost $1,234.",
      "",
      "99%",
    ];

    for (const value of sequence) {
      morph.update(value);

      const ids = live(element).map((c) => c.id);
      const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
      expect(duplicate, `"${value}" repeats ID ${duplicate}`).toBeUndefined();

      // An empty value keeps a zero-width space so the line box survives the
      // exits, so it is the one step that does not render its own text.
      if (value !== "") {
        expect(rendered(element).replace(/\n/g, "")).toBe(value.replace(/\n/g, ""));
      }
    }
  });
});

describe("disabled", () => {
  it("writes the value straight to the element", () => {
    const { element, morph } = mount({ disabled: true });
    morph.update("$1,234");

    expect(element.textContent).toBe("$1,234");
    expect(element.children.length).toBe(0);
  });
});
