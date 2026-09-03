// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { TextMorph } from "../index";
import type { TextMorphOptions } from "../types";
import { GROUP_MIN } from "../utils/replace-animate";
import {
  ATTR_EXITING,
  ATTR_ID,
  ATTR_ITEM,
  ATTR_KIND,
  ATTR_ROOT,
  ATTR_SLOT,
  ATTR_SR,
} from "../../utils/constants";

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

type Recorded = {
  id: string | null;
  onMover: boolean;
  keyframes: unknown;
  options: unknown;
};

/**
 * A numeric character's animation is split across two elements: the slot takes
 * the FLIP correction and the span nested inside it takes the slide, so the
 * slide happens behind the slot's clip. Only the slot carries an ID, so an
 * animation is attributed to the nearest ancestor that has one and flagged with
 * which of the two it landed on.
 */
function recordAnimations() {
  const calls: Recorded[] = [];
  const original = Element.prototype.animate;

  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    const owner = this.closest(`[${ATTR_ID}]`);
    calls.push({
      id: owner?.getAttribute(ATTR_ID) ?? null,
      onMover: owner !== this,
      keyframes,
      options,
    });
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
function transformCall(
  calls: Recorded[],
  id: string,
  onMover: boolean,
): Recorded | undefined {
  return calls.find((c) => {
    if (c.id !== id || c.onMover !== onMover) return false;
    const frames = (
      Array.isArray(c.keyframes) ? c.keyframes : [c.keyframes]
    ) as Frame[];
    return frames.some((frame) => frame.transform !== undefined);
  });
}

/** What layout did to a character — the transform on the item itself. */
function motion(calls: Recorded[], id: string): string | null {
  const call = transformCall(calls, id, false);
  if (!call) return null;

  if (Array.isArray(call.keyframes)) {
    const [from, to] = call.keyframes as Frame[];
    return `${from!.transform} → ${to!.transform}`;
  }
  const frame = call.keyframes as Frame;
  return `${frame.transform} @${frame.offset}`;
}

/** What the character did inside its slot — the block-axis slide. */
function slide(calls: Recorded[], id: string): string | null {
  const call = transformCall(calls, id, true);
  if (!call) return null;
  const frame = call.keyframes as Frame;
  return `${frame.transform} @${frame.offset}`;
}

const slideFrom = (dy: number) => `translate(0px, ${dy}px) @0`;
const slideOut = `translate(0px, ${SLIDE}px) @1`;
const textEnter = "translate(0px, 0px) scale(0.95) → none";
const textPersist = "translate(0px, 0px) scale(1) → none";
const textExit = "translate(0px, 0px) scale(0.95) @1";

type Child = {
  id: string;
  text: string;
  kind: string | null;
  exiting: boolean;
};

function children(element: HTMLElement): Child[] {
  // The root also holds the accessible copy of the value, which is not a
  // segment — counting it would double every string these assertions rebuild.
  return Array.from(element.children)
    .filter((child) => !child.hasAttribute(ATTR_SR))
    .map((child) => ({
      id: child.getAttribute(ATTR_ID)!,
      text: child.textContent ?? "",
      kind: child.getAttribute(ATTR_KIND),
      exiting: child.hasAttribute(ATTR_EXITING),
    }));
}

const live = (element: HTMLElement) =>
  children(element).filter((c) => !c.exiting);
const leaving = (element: HTMLElement) =>
  children(element).filter((c) => c.exiting);

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
    morph.update("999");

    const { calls, restore } = recordAnimations();
    morph.update("1,000");
    restore();

    const comma = idOf(element, ",");
    const leading = live(element)[0]!.id;

    // Digits arrive from above and symbols from below, so a separator appearing
    // between them reads as a different event from the digit that displaced it.
    // Both happen on the nested span, behind the slot's clip.
    expect(slide(calls, leading)).toBe(slideFrom(-SLIDE));
    expect(slide(calls, comma)).toBe(slideFrom(SLIDE));
  });

  it("leaves a digit that held its place untouched", () => {
    const { element, morph } = mount();
    morph.update("1234");
    const held = live(element)
      .map((c) => c.id)
      .slice(1);

    const { calls, restore } = recordAnimations();
    morph.update("1,234");
    restore();

    // Place matching keeps 2, 3 and 4 in their columns. With no delta to
    // correct and nothing to slide, animating them at all — on either the slot
    // or the character inside it — would be motion the number does not have.
    for (const id of held) {
      expect(motion(calls, id), `slot ${id}`).toBeNull();
      expect(slide(calls, id), `mover ${id}`).toBeNull();
    }
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

    for (const id of digits) expect(slide(calls, id)).toBe(slideOut);
  });
});

describe("the clip a slide happens behind", () => {
  it("gives every numeric character its own box, and nothing else one", () => {
    const { element, morph } = mount();
    morph.update("3 apples");

    const slots = Array.from(element.children).filter((child) =>
      child.hasAttribute(ATTR_SLOT),
    );

    // Exactly the digit, and the character itself moved into a nested span so
    // the slot around it has something to clip against.
    expect(slots.map((s) => s.textContent)).toEqual(["3"]);
    expect(slots[0]!.children.length).toBe(1);
    expect(slots[0]!.firstElementChild!.textContent).toBe("3");
  });

  it("leaves the root unclipped, which is the whole reason slots exist", () => {
    const { element, morph } = mount();
    morph.update("a\n1,234\nb");

    // The root spans every line of the value, so clipping there would bound
    // only the first line's top and the last line's bottom — a digit on the
    // middle line would slide over its neighbour in plain view.
    expect(element.style.overflowY).toBe("");
    expect(element.style.getPropertyValue("mask-image")).toBe("");
  });

  it("clips and fades the slot from the stylesheet, not per element", () => {
    const { element, morph } = mount();
    morph.update("$5");

    const slot = element.querySelector(`[${ATTR_SLOT}]`)!;
    expect(slot.getAttribute("style")).toBeNull();

    const css = document.querySelector("style[data-torph]")!.textContent!;
    expect(css).toContain(`[${ATTR_SLOT}]`);
    expect(css).toContain("--torph-fade");

    // clip-path, not overflow: overflow would synthesize the slot's baseline to
    // its bottom margin edge and lift every digit off the line the words sit on.
    expect(css).toContain("clip-path: inset(");
    expect(css).not.toContain("overflow-y: clip");
  });
});

describe("opting out", () => {
  it("numbers: false leaves digits as text, with no slots to slide in", () => {
    const { element, morph } = mount({ numbers: false });
    morph.update("hello");
    morph.update("$1,234");

    expect(shape(element).every((entry) => entry.endsWith(":text"))).toBe(true);
    expect(element.querySelector(`[${ATTR_SLOT}]`)).toBeNull();
  });
});

describe("numbers across line changes", () => {
  // Each of these moves a value between one line and several with a figure in
  // it. A digit's clip box is its own slot rather than the root, so none of it
  // should make any difference to how the number behaves.
  const steps = [
    "1,234",
    "1,234\ntotal", // gains a line below
    "Total\n5,678", // gains a line above and changes at once
    "a\n1,234\nb", // figure on a middle line
    "a\n5,678\nb", // middle line updates
    "text\n1,234",
    "1,234\ntext", // swaps lines with its label
    "5,678", // back onto one line
  ];

  it("keeps the figure a number on every line", () => {
    const { element, morph } = mount();

    for (const value of steps) {
      morph.update(value);

      const digits = live(element).filter((c) => c.kind !== null);
      expect(digits.length, `${JSON.stringify(value)} lost its number`).toBe(5);

      const ids = live(element).map((c) => c.id);
      const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
      expect(
        duplicate,
        `${JSON.stringify(value)} repeats an ID`,
      ).toBeUndefined();

      // `<br>` carries the line break and holds no text of its own.
      expect(rendered(element)).toBe(value.replace(/\n/g, ""));
    }
  });

  it("slides one line box, not the height of the whole block", () => {
    const { element, morph } = mount();
    // happy-dom has no layout, so the block height is stated rather than
    // measured. Three lines of it is what a digit must not travel.
    Object.defineProperty(element, "offsetHeight", {
      value: 60,
      configurable: true,
    });

    morph.update("1,234");
    let recorder = recordAnimations();
    morph.update("5,678");
    recorder.restore();
    expect(slide(recorder.calls, idOf(element, "5"))).toBe(slideFrom(-60));

    morph.update("a\n1,234\nb");
    recorder = recordAnimations();
    morph.update("a\n5,678\nb");
    recorder.restore();

    // Same 60px block, now three lines tall: the digit travels one of them.
    expect(slide(recorder.calls, idOf(element, "5"))).toBe(slideFrom(-20));
  });

  it("never hands the lines around the figure a slide", () => {
    const { element, morph } = mount();
    morph.update("a\n1,234\nb");
    const above = idOf(element, "a");
    const below = idOf(element, "b");

    const { calls, restore } = recordAnimations();
    morph.update("a\n5,678\nb");
    restore();

    // Whether they *moved* is a layout question happy-dom cannot answer — every
    // rect here is zero, so every delta is too. What it can answer is whether
    // they were treated as part of the number, which is what a leaked kind
    // would do to them.
    for (const id of [above, below]) {
      expect(slide(calls, id), `mover ${id}`).toBeNull();
    }
    expect(
      live(element)
        .filter((c) => c.text === "a" || c.text === "b")
        .map((c) => c.kind),
    ).toEqual([null, null]);
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
        expect(rendered(element).replace(/\n/g, "")).toBe(
          value.replace(/\n/g, ""),
        );
      }
    }
  });
});

describe("wholesale replacement", () => {
  const grouped = (calls: Recorded[]) =>
    calls.filter((call) => {
      const frames = (
        Array.isArray(call.keyframes) ? call.keyframes : [call.keyframes]
      ) as Frame[];
      return frames.some((frame) => frame.transform?.startsWith("scale("));
    });

  it("collapses a long replaced run instead of moving it character by character", () => {
    const { element, morph } = mount();
    morph.update("abcdefghijklmnop");
    const survivors = ["a", "b", "c", "m", "n", "o", "p"].map((c) =>
      idOf(element, c),
    );

    const { calls, restore } = recordAnimations();
    morph.update("abcmnopqrstuvwx");
    restore();

    // "defghijkl" leaves together and "qrstuvwx" arrives together — nine and
    // eight characters with nothing surviving between them.
    const ids = new Set(grouped(calls).map((call) => call.id));
    expect(ids.size).toBe(17);

    // The letters that survived are not part of either gesture; they still
    // move relative to their neighbours as themselves.
    for (const id of survivors) expect(ids.has(id)).toBe(false);
  });

  it("scales about a shared origin rather than each character's own", () => {
    const { element, morph } = mount();
    morph.update("abcdefghijklmnop");

    morph.update("abcmnopqrstuvwx");

    // Every member of a run states the same point in its own coordinates, which
    // is what makes one scale out of what would otherwise be sixteen.
    const origins = live(element)
      .filter((c) => ["q", "r", "s", "t", "u", "v", "w", "x"].includes(c.text))
      .map(
        (c) =>
          (
            Array.from(element.children).find(
              (child) => child.getAttribute(ATTR_ID) === c.id,
            ) as HTMLElement
          ).style.transformOrigin,
      );

    expect(origins.length).toBe(8);
    for (const origin of origins) expect(origin).not.toBe("");
  });

  it("leaves a short replacement to move on its own", () => {
    const { morph } = mount();
    morph.update("999,999");

    const { calls, restore } = recordAnimations();
    morph.update("1,000,000");
    restore();

    // The comma survives and splits the value into runs of five and three, so
    // nothing here is long enough to be worth replacing wholesale — and this is
    // the counter tick whose separator slide would be lost if it were.
    expect(grouped(calls)).toEqual([]);
  });

  it("replaces a figure that jumped orders of magnitude", () => {
    const { element, morph } = mount();
    morph.update("$999.50");
    const dollar = idOf(element, "$");

    const { calls, restore } = recordAnimations();
    morph.update("$1,000,000.00");
    restore();

    const ids = new Set(grouped(calls).map((call) => call.id));
    expect(ids.size).toBeGreaterThan(GROUP_MIN);
    expect(ids.has(dollar)).toBe(false);
  });
});

describe("timing", () => {
  it("keeps every fade a share of the duration at any speed", () => {
    for (const duration of [150, 400, 3000]) {
      const { morph } = mount({ duration });
      morph.update("hello 1");

      const { calls, restore } = recordAnimations();
      morph.update("world 2");
      restore();

      const fades = calls.filter((call) => {
        const frames = (
          Array.isArray(call.keyframes) ? call.keyframes : [call.keyframes]
        ) as Frame[];
        return frames.some((frame) => frame.opacity !== undefined);
      });

      expect(fades.length, `${duration}ms produced no fades`).toBeGreaterThan(
        0,
      );

      // A fixed ceiling here would decouple the fade from the transform: at
      // 3000ms a capped fade finishes a tenth of the way in and the character
      // sits opaque and still for the rest of it.
      for (const fade of fades) {
        const { duration: d, delay = 0 } = fade.options as {
          duration: number;
          delay?: number;
        };
        expect(d, `${duration}ms fade`).toBeLessThanOrEqual(duration);
        expect(d / duration, `${duration}ms fade share`).toBeGreaterThan(0.1);
        expect(delay / duration, `${duration}ms delay share`).toBeLessThan(0.5);
      }

      morph.destroy();
      mounted.pop();
    }
  });
});

describe("author sizing", () => {
  it("leaves no inline width or height behind for CSS to fight", () => {
    const { element, morph } = mount();

    morph.update("hello");
    morph.update("hello world");
    morph.update("$1,234");

    // An inline style outranks the page's own rules, so anything left here is
    // permanent. A root that its CSS puts at `width: 100%` has to still be at
    // `width: 100%` afterwards, or a `text-align` on it has no width left to
    // align within — which is exactly how a left/centre/right control dies.
    expect(element.style.width).toBe("");
    expect(element.style.height).toBe("");
  });

  it("sizes from the layout box, not an ancestor transform's visual one", () => {
    const { element, morph } = mount();
    morph.update("hello");

    // What a rotated or scaled ancestor does: every rect grows, the layout box does not.
    element.style.width = "80px";
    element.style.height = "20px";
    element.getBoundingClientRect = () =>
      ({ width: 200, height: 50, left: 0, top: 0 }) as DOMRect;

    const starts: string[] = [];
    const animate = element.animate.bind(element);
    element.animate = ((keyframes: Keyframe[], options: unknown) => {
      const first = Array.isArray(keyframes) ? keyframes[0] : undefined;
      if (first && "width" in first) starts.push(String(first.width));
      return animate(keyframes as never, options as never);
    }) as typeof element.animate;

    morph.update("hello world");

    // Starting from the inflated 200px is what balloons the root, morph on morph.
    expect(starts).toContain("80px");
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

/**
 * What the root draws and what it reads as come apart during a morph, and only
 * one of them is the value. The segments are a word cut to the character with
 * the last value's characters still animating out between them; read in order
 * they are a spelled-out jumble of two values at once.
 */
describe("what a screen reader gets", () => {
  const srNode = (element: HTMLElement) =>
    element.querySelector(`[${ATTR_SR}]`);

  it("carries the value as text, once, whatever the segments are doing", () => {
    const { element, morph } = mount();

    morph.update("hello world");
    expect(srNode(element)?.textContent).toBe("hello world");

    // Mid-morph: the previous value has characters still on their way out, and
    // the new one is split across boxes. Neither is readable; this is.
    morph.update("hello there");
    expect(leaving(element).length).toBeGreaterThan(0);
    expect(srNode(element)?.textContent).toBe("hello there");
  });

  it("hides every fragment it draws, including the ones exiting", () => {
    const { element, morph } = mount();
    morph.update("npm install");
    morph.update("npm i");

    const items = Array.from(
      element.querySelectorAll<HTMLElement>(`[${ATTR_ITEM}]`),
    );

    expect(items.length).toBeGreaterThan(0);
    expect(
      items.filter((item) => item.getAttribute("aria-hidden") !== "true"),
    ).toEqual([]);
  });

  it("does not read as a segment, so nothing tries to animate it", () => {
    const { element, morph } = mount();
    morph.update("hello");
    morph.update("world");

    const node = srNode(element) as HTMLElement;

    // It has no ID and never matches a segment, so the exit path would claim it
    // as an old child with no counterpart and animate it off.
    expect(node.hasAttribute(ATTR_EXITING)).toBe(false);
    expect(node.getAnimations().length).toBe(0);
    expect(node.style.position).toBe("");
  });

  it("comes back when reduced motion goes off again", () => {
    // The one runtime route out of animating: the query is live, and while it
    // matches a value is written as plain text, which replaces the root's
    // contents wholesale — stand-in included. An instance built under it has
    // also never been given the root attribute or the stylesheet.
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const query = {
      matches: true,
      addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
        listeners.add(fn),
      removeEventListener: (
        _: string,
        fn: (event: MediaQueryListEvent) => void,
      ) => listeners.delete(fn),
    };
    const original = window.matchMedia;
    window.matchMedia = (() => query) as unknown as typeof window.matchMedia;

    try {
      const { element, morph } = mount({ respectReducedMotion: true });

      morph.update("world");
      expect(element.textContent).toBe("world");
      expect(srNode(element)).toBe(null);

      query.matches = false;
      listeners.forEach((fn) => fn({ matches: false } as MediaQueryListEvent));

      morph.update("hello again");
      expect(element.hasAttribute(ATTR_ROOT)).toBe(true);
      expect(srNode(element)?.textContent).toBe("hello again");
    } finally {
      window.matchMedia = original;
    }
  });

  it("leaves nothing behind to render as a second copy", () => {
    const { element, morph } = mount();
    morph.update("hello");

    morph.destroy();

    expect(srNode(element)).toBe(null);
  });
});
