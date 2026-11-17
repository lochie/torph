// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll, beforeEach } from "vitest";
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
  ATTR_TEXT,
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

// happy-dom ignores `subtree`, and the engine waits on every animation under the root.
beforeAll(() => {
  const original = Element.prototype.getAnimations;
  Element.prototype.getAnimations = function (
    this: Element,
    options?: GetAnimationsOptions,
  ) {
    if (!options?.subtree) return original.call(this);
    return [this, ...Array.from(this.querySelectorAll("*"))].flatMap((el) =>
      original.call(el),
    );
  };
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

// A run the morph left alone is one box, so a character is found in whichever box holds it.
const idOf = (element: HTMLElement, text: string) =>
  (
    live(element).find((c) => c.text === text) ??
    live(element).find((c) => c.text.includes(text))!
  ).id;

/** At rest the value is one run of text; only a morph draws it as boxes. */
function drawn(morph: TextMorph, value: string) {
  morph.update("\u2026");
  morph.update(value);
}

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
    drawn(morph, "$1,234");

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
    drawn(morph, "3 unread messages");

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

    expect(motion(calls, idOf(element, "hello"))).toBeNull();
    expect(motion(calls, idOf(element, "there"))).toBe(textEnter);
  });

  it("dispatches exits on the kind the element left with", () => {
    const { element, morph } = mount();
    morph.update("$5 hello");

    const { calls, restore } = recordAnimations();
    morph.update("$5");
    restore();
    const digit = idOf(element, "5");
    const word = leaving(element).find((c) => c.text === "hello")!.id;

    expect(leaving(element).map((c) => c.text)).toContain("hello");
    expect(motion(calls, word)).toBe(textExit);
    expect(motion(calls, digit)).toBeNull(); // held its place, never left
  });

  it("slides a departing digit out", () => {
    const { element, morph } = mount();
    morph.update("42");

    const { calls, restore } = recordAnimations();
    morph.update("hello");
    restore();
    const digits = leaving(element)
      .filter((c) => c.kind)
      .map((c) => c.id);
    expect(digits).toHaveLength(2);

    for (const id of digits) expect(slide(calls, id)).toBe(slideOut);
  });
});

describe("the clip a slide happens behind", () => {
  it("gives every numeric character its own box, and nothing else one", () => {
    const { element, morph } = mount();
    drawn(morph, "3 apples");

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

  it("sizes the clip in CSS, so a line-height change needs no morph", () => {
    const { morph } = mount();
    morph.update("$5");

    const css = document.querySelector("style[data-torph]")!.textContent!;
    // The line-height is applied by the stylesheet; the engine only supplies the ink, in em.
    expect(css).toContain(
      "var(--torph-fade, 0.15em) + var(--torph-ink-top, 0.6em) - 0.5lh",
    );
    expect(css).toContain(
      "var(--torph-fade, 0.15em) + var(--torph-ink-bottom, 0.6em) - 0.5lh",
    );
    // The box itself grows, since the mask only acts inside the border box.
    expect(css).toContain(
      "padding-block: var(--torph-top) var(--torph-bottom);",
    );
    // Registering any custom property roughly doubles each morph's restyle in Chrome.
    expect(css).not.toContain("@property");
    // Nothing the stylesheet explains ships inside it.
    expect(css).not.toContain("/*");
  });

  it("hands the stylesheet the ink and slides the digit past the clip it draws", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    element.style.lineHeight = "20px";
    morph.update("999");

    // A 20px content area on a 20px line, its digits reaching 2px above it.
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => ({
      font: "",
      measureText: () => ({
        fontBoundingBoxAscent: 16,
        fontBoundingBoxDescent: 4,
        actualBoundingBoxAscent: 18,
        actualBoundingBoxDescent: 2,
      }),
    })) as unknown as typeof getContext;
    const supports = CSS.supports;
    CSS.supports = () => true;
    const { calls, restore } = recordAnimations();
    try {
      morph.update("1,000");
    } finally {
      restore();
      HTMLCanvasElement.prototype.getContext = getContext;
      CSS.supports = supports;
    }

    // From the line's centre, 6px above the baseline: 12px up, 8px down.
    expect(element.style.getPropertyValue("--torph-ink-top")).toBe("0.6000em");
    expect(element.style.getPropertyValue("--torph-ink-bottom")).toBe(
      "0.4000em",
    );
    // Fade 3px past half a 20px line: 5px above, 1px below.
    expect(slide(calls, live(element)[0]!.id)).toBe(slideFrom(-(SLIDE + 6)));
  });

  it("clips and fades the slot from the stylesheet, not per element", () => {
    const { element, morph } = mount();
    drawn(morph, "$5");

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
    morph.update("\u2026");

    for (const value of steps) {
      morph.update(value);

      // A line the morph didn't touch is one box drawn as text, so its figure needs no slots.
      const digits = live(element).filter((c) => c.kind !== null);
      const figure = value.split("\n").find((line) => /\d/.test(line))!;
      const whole = live(element).some((c) => c.text === figure);
      expect(
        digits.length === 5 || whole,
        `${JSON.stringify(value)} lost its number`,
      ).toBe(true);

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

    const { calls, restore } = recordAnimations();
    morph.update("a\n5,678\nb");
    restore();
    const above = idOf(element, "a");
    const below = idOf(element, "b");

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

    const { calls, restore } = recordAnimations();
    morph.update("abcmnopqrstuvwx");
    restore();
    const survivors = ["a", "b", "c", "m", "n", "o", "p"].map((c) =>
      idOf(element, c),
    );

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

    const { calls, restore } = recordAnimations();
    morph.update("$1,000,000.00");
    restore();
    const dollar = idOf(element, "$");

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

describe("plain text at rest", () => {
  const text = (element: HTMLElement) =>
    element.querySelector<HTMLElement>(`[${ATTR_TEXT}]`);
  const items = (element: HTMLElement) =>
    element.querySelectorAll(`[${ATTR_ITEM}]`);

  it("renders the first value as one run of text, with no boxes", () => {
    const { element, morph } = mount();
    morph.update("Total\n$1,234");
    expect(items(element)).toHaveLength(0);
    expect(text(element)?.textContent).toBe("Total$1,234");
    expect(text(element)?.querySelectorAll("br")).toHaveLength(1);
    expect(text(element)?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the boxes while anything is still moving", async () => {
    const { element, morph } = mount({ duration: 50 });
    morph.update("Copy");
    morph.update("Copied");
    await Promise.resolve();
    expect(text(element)).toBeNull();
    expect(items(element).length).toBeGreaterThan(0);
  });

  it("goes back to one run of text once everything has settled", async () => {
    const { element, morph } = mount({ duration: 20 });
    morph.update("Copy");
    morph.update("Copied");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(items(element)).toHaveLength(0);
    expect(text(element)?.textContent).toBe("Copied");
  });

  it("draws an interrupting morph on the boxes already there", () => {
    const { element, morph } = mount();
    morph.update("Copy");
    morph.update("Copied");
    morph.update("Copier");
    expect(text(element)).toBeNull();
    const live = Array.from(items(element)).filter(
      (i) => !i.hasAttribute(ATTR_EXITING),
    );
    expect(live.map((i) => i.textContent).join("")).toBe("Copier");
  });
});

describe("boxes sized to the text", () => {
  // The engine's probe: points at its own `left` and `top`, as far from the origin as the scale puts them.
  const probe = (fallback: Element["getBoundingClientRect"], scale = 1) =>
    function (this: Element) {
      if (this.tagName !== "I") return fallback.call(this);
      const { left, top } = (this as HTMLElement).style;
      return new DOMRect(
        (parseFloat(left) || 0) * scale,
        (parseFloat(top) || 0) * scale,
        0,
        0,
      );
    };

  // Every glyph 10px wide and "Co" kerned 2px tighter, as the browser would lay the run out.
  // `scale` stands in for a transformed ancestor: every rect on screen grows, the layout does not.
  function fakeLayout(scale = 1) {
    const range = Range.prototype.getBoundingClientRect;
    const element = Element.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const at = (i: number) => i * 10 - (i >= 1 ? 2 : 0);
      const data = (this.startContainer as Text).data ?? "";
      const kerned = data.startsWith("Co");
      const x = (i: number) => (kerned ? at(i) : i * 10) * scale;
      return new DOMRect(
        x(this.startOffset),
        0,
        x(this.endOffset) - x(this.startOffset),
        20 * scale,
      );
    };
    Element.prototype.getBoundingClientRect = probe(element, scale);
    return () => {
      Range.prototype.getBoundingClientRect = range;
      Element.prototype.getBoundingClientRect = element;
    };
  }

  const widths = (element: HTMLElement) =>
    Array.from(
      element.querySelectorAll<HTMLElement>(
        `[${ATTR_ITEM}]:not([${ATTR_EXITING}])`,
      ),
    ).map((child) => child.style.width);

  it("gives each box the advance its segment has in the text", () => {
    const restore = fakeLayout();
    try {
      const { element, morph } = mount();
      morph.update("Copy");
      morph.update("Copied");
      // "Cop" didn't change, so it is one box: its own kerning comes with it.
      expect(widths(element)).toEqual(["28px", "10px", "10px", "10px"]);
    } finally {
      restore();
    }
  });

  it("measures between leading edges when the text runs right to left", () => {
    // The same advances mirrored: the first letter at the right, each next one to its left.
    const range = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const at = (i: number) => i * 10 - (i >= 1 ? 2 : 0);
      return new DOMRect(
        200 - at(this.endOffset),
        0,
        at(this.endOffset) - at(this.startOffset),
        20,
      );
    };
    const element = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = probe(element);
    try {
      const { element: root, morph } = mount();
      root.style.direction = "rtl";
      morph.update("שלום");
      morph.update("שלומי");
      // "שלו" is one 28px box measured right edge to right edge; left to left would give 10px.
      expect(widths(root)).toEqual(["28px", "10px", "10px"]);
    } finally {
      Range.prototype.getBoundingClientRect = range;
      Element.prototype.getBoundingClientRect = element;
    }
  });

  it("takes an ancestor's scale back out", () => {
    const restore = fakeLayout(1.5);
    try {
      const { element, morph } = mount();
      morph.update("Copy");
      morph.update("Copied");
      // "Cop" didn't change, so it is one box: its own kerning comes with it.
      expect(widths(element)).toEqual(["28px", "10px", "10px", "10px"]);
    } finally {
      restore();
    }
  });

  it("leaves the boxes unsized where the text has no layout", () => {
    const { element, morph } = mount();
    morph.update("Copy");
    morph.update("Copied");
    expect(widths(element).every((width) => width === "")).toBe(true);
  });
});

describe("ligatures across item boundaries", () => {
  // "->" is one arrow glyph, which letter-spacing breaks apart as Chromium does.
  function arrowRuler() {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => ({
      font: "",
      letterSpacing: "0px",
      measureText(this: { letterSpacing: string }, text: string) {
        const spacing = parseFloat(this.letterSpacing);
        const glyphs = [...text].length - (text === "->" && !spacing ? 1 : 0);
        return { width: glyphs * (10 + spacing) };
      },
    })) as unknown as typeof getContext;
    return () => (HTMLCanvasElement.prototype.getContext = getContext);
  }

  const items = (element: HTMLElement, exiting = false) =>
    Array.from(
      element.querySelectorAll<HTMLElement>(
        `[${ATTR_ITEM}]${exiting ? "" : `:not([${ATTR_EXITING}])`}`,
      ),
    );
  const texts = (element: HTMLElement) =>
    items(element).map((item) => item.textContent);
  let restore: () => void;
  beforeEach(() => (restore = arrowRuler()));
  afterEach(() => restore());

  it("leaves the first render's ligatures to the browser", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a->b");
    expect(texts(element)).toEqual([]);
    expect(element.querySelector(`[${ATTR_TEXT}]`)?.textContent).toBe("a->b");
  });

  // Whether the arrow sits in a box of its own or inside a run left whole, no two boxes split it.
  const splitsArrow = (element: HTMLElement) => {
    const t = items(element).map((item) => item.textContent ?? "");
    return t.some((x, i) => x.endsWith("-") && t[i + 1]?.startsWith(">"));
  };

  it("keeps the arrow in one box through every morph", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a->b");
    for (const value of ["a->c", "x->c", "x->y now", "x->y"]) {
      morph.update(value);
      expect(splitsArrow(element), value).toBe(false);
      expect(texts(element).join("")).toBe(value.replace(" ", "\u00A0"));
    }
  });

  it("swaps the parts for the ligature when it forms", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a-b");
    morph.update("a-c");
    morph.update("a->c");
    expect(texts(element).join("")).toBe("a->c");
    expect(splitsArrow(element)).toBe(false);
    // The lone hyphen leaves; nothing but the arrow draws an arrowhead.
    const leaving = items(element, true)
      .filter((item) => item.hasAttribute(ATTR_EXITING))
      .map((item) => item.textContent);
    expect(leaving.some((text) => text!.includes(">"))).toBe(false);
  });

  it("lets the ligature leave whole when it breaks", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a->b");
    morph.update("a->c");
    morph.update("a-c");
    expect(texts(element).join("")).toBe("a-c");
    // Whatever leaves with the arrowhead takes the whole arrow with it.
    const leaving = items(element, true)
      .filter((item) => item.hasAttribute(ATTR_EXITING))
      .map((item) => item.textContent ?? "");
    expect(
      leaving.filter((t) => t.includes(">")).every((t) => t.includes("->")),
    ).toBe(true);
  });

  it("forms on a changed line, and leaves an unchanged one whole", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a->b\nc->d");
    morph.update("a->b\nc->e");
    // The first line didn't change, so it is one box: the text draws its arrow.
    expect(texts(element)).toContain("a->b");
    expect(splitsArrow(element)).toBe(false);
    expect(element.querySelectorAll("br")).toHaveLength(1);
  });

  it("re-forms cleanly when a break is interrupted", () => {
    const { element, morph } = mount();
    element.style.fontSize = "20px";
    morph.update("a->b");
    morph.update("a->c");
    morph.update("a-c");
    morph.update("a->c");
    expect(texts(element)).toEqual(["a", "->", "c"]);
    // In flow, only the one arrow — no stray half of it left behind.
    expect(
      new Set(items(element).map((item) => item.getAttribute(ATTR_ID))).size,
    ).toBe(3);
  });
});

describe("direction", () => {
  it("lets the text set the root's direction, so a box per letter reads in order", () => {
    const { element, morph } = mount();
    morph.update("AVATAR");
    expect(element.getAttribute("dir")).toBe("ltr");
    morph.update("שלום AVATAR");
    expect(element.getAttribute("dir")).toBe("rtl");
    // Digits and punctuation have no direction; the first letter decides.
    morph.update("12: مرحبا");
    expect(element.getAttribute("dir")).toBe("rtl");
    morph.destroy();
    expect(element.hasAttribute("dir")).toBe(false);
  });

  it("leaves a direction the page set alone", () => {
    const element = document.createElement("span");
    element.setAttribute("dir", "rtl");
    document.body.appendChild(element);
    const morph = new TextMorph({ element, respectReducedMotion: false });
    morph.update("שלום");
    morph.destroy();
    expect(element.getAttribute("dir")).toBe("rtl");
  });

  it("draws an Arabic word as one box in a morph", () => {
    const { element, morph } = mount();
    drawn(morph, "مرحبا");
    const items = element.querySelectorAll(
      `[${ATTR_ITEM}]:not([${ATTR_EXITING}])`,
    );
    expect(Array.from(items, (item) => item.textContent)).toEqual(["مرحبا"]);
  });
});

describe("exactly one of complete and cancel per morph", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

  function counted(options: Partial<TextMorphOptions> = {}) {
    const calls: string[] = [];
    const { element, morph } = mount({
      duration: 30,
      onAnimationComplete: () => calls.push("complete"),
      onAnimationCancel: () => calls.push("cancel"),
      ...options,
    });
    return { element, morph, calls };
  }

  it("completes a morph once, after it has settled", async () => {
    const { morph, calls } = counted();
    morph.update("hello");
    morph.update("hello world");
    expect(calls).toEqual([]);
    await settle();
    expect(calls).toEqual(["complete"]);
  });

  it("cancels the morph an update interrupts, and completes the one that replaces it", async () => {
    const { morph, calls } = counted();
    morph.update("hello");
    morph.update("hello world");
    morph.update("hello there");
    await settle();
    expect(calls).toEqual(["cancel", "complete"]);
  });

  it("completes a morph out of an empty value rather than cancelling it", async () => {
    const { morph, calls } = counted();
    morph.update("hi");
    morph.update("");
    await settle();
    calls.length = 0;
    morph.update("hello");
    await settle();
    expect(calls).toEqual(["complete"]);
  });

  it("fires neither for a morph torn down part-way", async () => {
    const { morph, calls } = counted();
    morph.update("hello");
    morph.update("hello world");
    morph.destroy();
    await settle();
    expect(calls).toEqual([]);
  });
});

describe("a morph splits only the lines it changes", () => {
  const boxes = (element: HTMLElement) =>
    Array.from(
      element.querySelectorAll<HTMLElement>(
        `[${ATTR_ITEM}]:not([${ATTR_EXITING}]):not(br)`,
      ),
      (item) => item.textContent,
    );

  it("draws every untouched line as one box", () => {
    const { element, morph } = mount();
    morph.update("alpha beta\ngamma delta\nepsilon zeta");
    morph.update("alpha beta\ngamma omega\nepsilon zeta");
    expect(boxes(element)).toEqual([
      "alpha beta",
      "gamma",
      " ",
      "omega",
      "epsilon zeta",
    ]);
  });

  it("opens a whole line back up when a morph interrupts it", () => {
    const { element, morph } = mount();
    morph.update("alpha beta\ngamma delta");
    morph.update("alpha beta\ngamma omega");
    morph.update("alpha gamma\ngamma omega");
    // The first line was whole and changed, so it is back in parts; the second,
    // mid-morph in parts, stays in parts rather than be swapped for a new box.
    expect(boxes(element).join("|")).toBe(
      "alpha|\u00A0|gamma|gamma|\u00A0|omega",
    );
    const ids = Array.from(element.querySelectorAll(`[${ATTR_ITEM}]`), (item) =>
      item.getAttribute(ATTR_ID),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps later lines whole when an earlier one changes length", () => {
    const { element, morph } = mount();
    morph.update("a b\nc d\ne f");
    morph.update("a longer b\nc d\ne f");
    expect(boxes(element).slice(-2)).toEqual(["c\u00A0d", "e\u00A0f"]);
  });
});

describe("queued updates", () => {
  const items = (element: HTMLElement) =>
    element.querySelectorAll(`[${ATTR_ITEM}]`).length;

  it("waits for the microtask, then morphs every instance queued with it", async () => {
    const a = mount();
    const b = mount();
    a.morph.update("one");
    b.morph.update("two");
    a.morph.queue("one more");
    b.morph.queue("two more");
    expect(items(a.element) + items(b.element)).toBe(0);
    await Promise.resolve();
    expect(items(a.element)).toBeGreaterThan(0);
    expect(items(b.element)).toBeGreaterThan(0);
  });

  it("runs what is queued along with an update", () => {
    const a = mount();
    const b = mount();
    a.morph.update("one");
    b.morph.update("two");
    a.morph.queue("one more");
    b.morph.update("two more");
    expect(items(a.element)).toBeGreaterThan(0);
  });

  it("drops a queued update when destroyed", async () => {
    const { element, morph } = mount();
    morph.update("one");
    morph.queue("one more");
    morph.destroy();
    await Promise.resolve();
    expect(items(element)).toBe(0);
    expect(element.textContent).toContain("one");
    expect(element.textContent).not.toContain("more");
  });
});
