// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TextMorph } from "../../lib/text-morph";
import type { TextMorphOptions } from "../../lib/text-morph/types";
import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { ATTR_EXITING } from "../../lib/utils/constants";
import { blur } from "../blur";
import { words } from "../words";
import { scramble } from "../scramble";
import { flap } from "../flap";
import { typewriter } from "../typewriter";
import { tokens } from "../tokens";
import { odometer } from "../odometer";
import { wave } from "../wave";
import { wipe } from "../wipe";
import { caseless } from "../caseless";
import { anagram } from "../anagram";
import { stack } from "../stack";
import { squash } from "../squash";
import { redline } from "../redline";
import { countup } from "../countup";
import { skeleton } from "../skeleton";
import { magnet } from "../magnet";
import { weight } from "../weight";

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

const mounted: TextMorph[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  document.body.innerHTML = "";
});

// Boxes at rest, and none joined: these tests follow each box, which plain text at rest would drop.
const held: TorphPlugin = { name: "held", boxes: () => true };

function mount(
  options: Partial<TextMorphOptions> = {},
  { rest = false }: { rest?: boolean } = {},
) {
  const element = document.createElement("span");
  document.body.appendChild(element);
  const morph = new TextMorph({
    element,
    duration: 40,
    respectReducedMotion: false,
    ...options,
    plugins: [...(options.plugins ?? []), ...(rest ? [] : [held])],
  });
  mounted.push(morph);
  return { element, morph };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const boxes = (element: HTMLElement) =>
  Array.from(
    element.querySelectorAll<HTMLElement>(`[torph-id]:not([${ATTR_EXITING}])`),
  );

describe("blur", () => {
  // happy-dom's getKeyframes() drops `filter`, so animations are read on the way in.
  function record(run: () => void) {
    const calls: { frames: string; delay: number }[] = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, frames, options) {
      calls.push({
        frames: JSON.stringify(frames),
        delay: (options as KeyframeAnimationOptions)?.delay ?? 0,
      });
      return animate.call(this, frames, options);
    };
    try {
      run();
    } finally {
      Element.prototype.animate = animate;
    }
    return calls.filter((c) => c.frames.includes("blur(6px)"));
  }

  it("rises letters into focus and blurs them away upwards, one after another", async () => {
    // An ease of the test's own, so blur's spring doesn't stretch the morph past the wait.
    const { element, morph } = mount({
      plugins: [blur({ amount: "6px" })],
      ease: "linear",
    });
    const calls = record(() => {
      morph.update("one");
      morph.update("two");
    });
    // "t" and "w" arrive, "n" and "e" leave; "o" only moves.
    const entering = calls.filter((c) => c.frames.includes("+ 0.35em"));
    const leaving = calls.filter((c) => c.frames.includes("- 0.35em"));
    expect(entering.length).toBe(2);
    expect(leaving.length).toBe(2);
    expect(entering[1]!.delay).toBeGreaterThan(entering[0]!.delay);
    expect(leaving[1]!.delay).toBeGreaterThan(leaving[0]!.delay);
    await wait(250);
    expect(element.querySelectorAll(`[${ATTR_EXITING}]`).length).toBe(0);
  });

  it("draws a new word a box per letter", () => {
    const { element, morph } = mount({ plugins: [blur()] });
    morph.update("hello");
    morph.update("hello world");
    expect(boxes(element).map((b) => b.textContent)).toEqual([
      ..."hello",
      "\u00A0",
      ..."world",
    ]);
  });
});

describe("words", () => {
  it("keeps every word whole", () => {
    const { element, morph } = mount({ plugins: [words()] });
    morph.update("hello world");
    morph.update("hello there");
    expect(boxes(element).map((b) => b.textContent)).toEqual([
      "hello",
      " ",
      "there",
    ]);
  });
});

describe("scramble", () => {
  it("lands on the real text, and lets go of the width it held", async () => {
    const { element, morph } = mount({ plugins: [scramble({ rate: 0 })] });
    morph.update("ab");
    morph.update("abcd");
    await wait(200);
    expect(
      boxes(element)
        .map((b) => b.textContent)
        .join(""),
    ).toBe("abcd");
    expect(boxes(element).every((b) => b.style.width === "")).toBe(true);
  });

  it("scrambles leaving letters away one after another", async () => {
    const { element, morph } = mount({
      plugins: [scramble({ glyphs: "#", rate: 0 })],
      ease: "linear",
      duration: 200,
    });
    morph.update("abcd");
    const leaving = boxes(element).slice(1);
    const gone: string[] = [];
    const scrambled = new Set<string>();
    const watch = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.removedNodes) {
          const i = leaving.indexOf(node as HTMLElement);
          if (i >= 0) gone.push("bcd"[i]!);
        }
        if (r.target instanceof Element || r.target.parentElement) {
          const box = (
            r.target instanceof Element ? r.target : r.target.parentElement
          )!;
          if (leaving.includes(box as HTMLElement))
            scrambled.add(box.textContent ?? "");
        }
      }
    });
    watch.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    morph.update("a");
    await wait(400);
    watch.disconnect();
    expect(scrambled.has("#")).toBe(true);
    expect(gone).toEqual(["b", "c", "d"]);
  });

  it("stops writing once the next morph takes over", async () => {
    const { element, morph } = mount({
      plugins: [scramble({ glyphs: "#", rate: 0 })],
      duration: 400,
    });
    morph.update("ab");
    morph.update("abcd");
    // "c" and "d" were mid-scramble, and survive into the new value.
    morph.update("abcd!");
    await wait(80);
    const text = boxes(element).map((b) => b.textContent);
    expect(text.slice(0, 4).join("")).toBe("abcd");
  });
});

/** Every call to `animate` while `run` runs, keyframes as JSON. */
function animations(run: () => void) {
  const calls: {
    box: Element;
    frames: string;
    options: KeyframeAnimationOptions;
  }[] = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, frames, options) {
    calls.push({
      box: this,
      frames: JSON.stringify(frames),
      options: (options ?? {}) as KeyframeAnimationOptions,
    });
    return animate.call(this, frames, options);
  };
  try {
    run();
  } finally {
    Element.prototype.animate = animate;
  }
  return calls;
}

describe("flap", () => {
  it("flips each changed place round the drum, in the same box", async () => {
    const { element, morph } = mount({
      plugins: [flap({ flips: 10 })],
      ease: "linear",
    });
    morph.update("CAT");
    const middle = boxes(element)[1]!;
    morph.update("CUT");
    // The place kept its box; only its letter changed.
    expect(boxes(element)[1]).toBe(middle);
    const faces: string[] = [];
    const watch = new MutationObserver(() =>
      faces.push(middle.textContent ?? ""),
    );
    watch.observe(middle, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    await wait(200);
    watch.disconnect();
    // A to U is twenty turns; the last ten show, ending on the new letter.
    expect(faces.slice(-3)).toEqual(["S", "T", "U"]);
    expect(
      boxes(element)
        .map((b) => b.textContent)
        .join(""),
    ).toBe("CUT");
  });

  it("flips word for word, however different the words are", () => {
    const { element, morph } = mount({ plugins: [flap()] });
    morph.update("DEPARTING");
    const before = boxes(element);
    morph.update("BOARDING");
    const after = boxes(element);
    // Eight places keep their boxes; the ninth folds away.
    expect(after).toEqual(before.slice(0, 8));
  });
});

describe("typewriter", () => {
  it("backspaces from the end, then types in order", () => {
    const { morph } = mount({ plugins: [typewriter({ keystroke: 10 })] });
    morph.update("abc");
    const calls = animations(() => morph.update("axy"));
    const delays = Object.fromEntries(
      calls.map((c) => [c.box.textContent, c.options.delay ?? 0]),
    );
    // "c" goes before "b"; "x" and "y" follow once both are gone.
    expect(delays).toMatchObject({ c: 0, b: 10, x: 20, y: 30 });
  });
});

describe("tokens", () => {
  it("keeps the tokens an identifier still has", () => {
    const { element, morph } = mount({ plugins: [tokens()] });
    morph.update("getUserName");
    const before = new Map(boxes(element).map((b) => [b.textContent, b]));
    morph.update("getUserEmail");
    const after = boxes(element);
    expect(after.map((b) => b.textContent)).toEqual(["get", "User", "Email"]);
    expect(after[0]).toBe(before.get("get"));
    expect(after[1]).toBe(before.get("User"));
  });

  it("keeps a path's folders", () => {
    const { element, morph } = mount({ plugins: [tokens()] });
    morph.update("src/lib/a.ts");
    const before = boxes(element);
    morph.update("src/lib/b.ts");
    const after = boxes(element);
    expect(after.map((b) => b.textContent).join("")).toBe("src/lib/b.ts");
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4));
  });
});

describe("odometer", () => {
  it("keeps each place's wheel, lined up from the right", async () => {
    const { element, morph } = mount({ plugins: [odometer()], ease: "linear" });
    morph.update("$1,299");
    const before = boxes(element);
    morph.update("$1,300");
    const after = boxes(element);
    expect(after).toEqual(before);
    // Mid-turn a wheel holds every digit it passes; once settled, just the new one.
    await wait(150);
    expect(after.map((b) => b.textContent).join("")).toBe("$1,300");
    expect(
      after.filter((b) => b.getAttribute("torph-kind")?.startsWith("wheel-"))
        .length,
    ).toBe(4);
  });

  /** The digits a wheel shows mid-turn, and whether it starts at the top (turning up). */
  function turn(
    trend: "auto" | "up" | "down" | undefined,
    from: string,
    to: string,
  ) {
    const { element, morph } = mount({
      plugins: [odometer(trend ? { trend } : {})],
      ease: "linear",
    });
    morph.update(from);
    const calls = animations(() => morph.update(to));
    const wheel = element.querySelector<HTMLElement>(
      "[torph-kind^=wheel-] > span",
    )!;
    const scroll = calls.find(
      (c) => c.box === wheel && c.frames.includes("translateY"),
    )!;
    return {
      digits: wheel.textContent,
      up: JSON.parse(scroll.frames)[0].transform === "none",
    };
  }

  it("turns up through every digit between as the figure rises", () => {
    expect(turn(undefined, "7", "9")).toEqual({ digits: "7\n8\n9", up: true });
  });

  it("turns down as the figure falls", () => {
    expect(turn(undefined, "9", "7")).toEqual({ digits: "7\n8\n9", up: false });
  });

  it("sends a lost place away the way the figure went", () => {
    const { element, morph } = mount({ plugins: [odometer()] });
    morph.update("$1,450");
    const thousands = boxes(element)[1]!;
    const calls = animations(() => morph.update("$998"));
    const exit = calls.find((c) => c.box.parentElement === thousands)!;
    // Falling, it drops: a positive translateY.
    expect(exit.frames).toMatch(/translateY\(\d/);
  });

  it("turns one way only when told, the long way round if it must", () => {
    expect(turn("up", "9", "7")).toEqual({
      digits: "9\n0\n1\n2\n3\n4\n5\n6\n7",
      up: true,
    });
  });

  it("keeps the prefix in its box when the figure shrinks", () => {
    const { element, morph } = mount({ plugins: [odometer()] });
    morph.update("$1,450");
    const dollar = boxes(element)[0];
    morph.update("$998");
    expect(boxes(element)[0]).toBe(dollar);
    expect(boxes(element)[0]!.textContent).toBe("$");
  });

  it("leaves no turn behind when changes come faster than it can roll", async () => {
    const { element, morph } = mount({ plugins: [odometer()], ease: "linear" });
    morph.update("$1,299");
    morph.update("$1,300");
    morph.update("$1,450");
    morph.update("$998");
    await wait(150);
    const wheels = Array.from(
      element.querySelectorAll<HTMLElement>("[torph-kind^=wheel-] > span"),
    );
    expect(wheels.map((w) => w.textContent).join("")).toBe("998");
    expect(wheels.flatMap((w) => w.getAnimations())).toEqual([]);
  });

  it("adds a place as the figure grows", () => {
    const { element, morph } = mount({ plugins: [odometer()] });
    morph.update("999");
    const ones = boxes(element).at(-1);
    morph.update("1,000");
    expect(boxes(element).at(-1)).toBe(ones);
    expect(boxes(element).length).toBe(5);
  });
});

describe("wave", () => {
  it("drops letters in and lets them fall, one after another", () => {
    const { morph } = mount({ plugins: [wave()] });
    morph.update("ab");
    const calls = animations(() => morph.update("cd"));
    const drops = calls.filter((c) => c.frames.includes("- 0.6em"));
    const falls = calls.filter((c) => c.frames.includes("0.6em * 1.5"));
    expect(drops.length).toBe(2);
    expect(falls.length).toBe(2);
    expect(drops[1]!.options.delay).toBeGreaterThan(
      drops[0]!.options.delay ?? 0,
    );
  });
});

describe("wipe", () => {
  it("clips the old text away and the new text in, numbers included", () => {
    const { morph } = mount({ plugins: [wipe()] });
    morph.update("a $5");
    const calls = animations(() => morph.update("b $6"));
    const wiped = calls
      .filter((c) => c.frames.includes("inset("))
      .map((c) => c.box.textContent);
    expect(wiped.sort()).toEqual(["5", "6", "a", "b"]);
  });
});

describe("caseless", () => {
  it("keeps every letter when a word changes case", () => {
    const { element, morph } = mount({ plugins: [caseless()] });
    morph.update("hello world");
    morph.update("Hello World");
    expect(
      boxes(element)
        .map((b) => b.textContent)
        .join(""),
    ).toBe("Hello\u00A0World");
    expect(element.querySelectorAll("[torph-exiting]").length).toBe(0);
  });
});

describe("anagram", () => {
  it("reuses every letter, across words and in any order", () => {
    const { element, morph } = mount({ plugins: [anagram()] });
    morph.update("dormitory");
    const before = boxes(element);
    morph.update("dirty room");
    const after = boxes(element);
    expect(after.map((b) => b.textContent).join("")).toBe("dirty\u00A0room");
    // Every letter of "dirty room" was already in "dormitory"; only the space is new.
    expect(
      after.filter((b) => !before.includes(b)).map((b) => b.textContent),
    ).toEqual(["\u00A0"]);
  });
});

describe("stack", () => {
  it("draws the value as one card, swapped whole", () => {
    const { element, morph } = mount({ plugins: [stack()] });
    morph.update("Uploading 3 files");
    const first = boxes(element);
    morph.update("Uploaded");
    expect(first.length).toBe(1);
    expect(boxes(element).map((b) => b.textContent)).toEqual(["Uploaded"]);
    expect(first[0]!.hasAttribute("torph-exiting")).toBe(true);
  });
});

describe("squash", () => {
  it("stretches a box along its path and squashes it as it lands", () => {
    const { morph } = mount({ plugins: [squash()] });
    morph.update("red blue");
    // happy-dom has no layout, so the move is faked through the measured delta.
    const rect = Element.prototype.getBoundingClientRect;
    let shift = 0;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const r = rect.call(this);
      return this.textContent === "blue"
        ? new DOMRect(r.x + shift, r.y, 40, 20)
        : r;
    };
    try {
      shift = 80;
      const calls = animations(() => morph.update("blue red"));
      expect(calls.some((c) => c.frames.includes("scale("))).toBe(true);
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
  });
});

describe("redline", () => {
  it("strikes removed words through in the line, and underlines added ones", () => {
    const { element, morph } = mount({ plugins: [redline()] });
    morph.update("the quick brown fox");
    const calls = animations(() => morph.update("the quick red fox"));
    const struck = calls
      .filter((c) => c.frames.includes("#ff6b6b"))
      .map((c) => c.box.textContent);
    const added = calls
      .filter((c) => c.frames.includes("#6bdc8b"))
      .map((c) => c.box.textContent);
    // Spaces hold the line's shape but carry no mark.
    expect(struck).toEqual(["brown"]);
    expect(added).toEqual(["red"]);
    const order = Array.from(element.querySelectorAll("[torph-id]")).map(
      (b) => b.textContent,
    );
    expect(order).toEqual([
      "the",
      "\u00A0",
      "quick",
      "\u00A0",
      "brown",
      "\u00A0",
      "red",
      "\u00A0",
      "fox",
    ]);
  });
});

describe("countup", () => {
  it("counts through the values between, landing on the new one", async () => {
    const { element, morph } = mount({
      plugins: [countup({ time: 100, steps: 5 })],
    });
    morph.update("$1,000");
    const seen = new Set<string>();
    const watch = new MutationObserver(() =>
      seen.add(
        boxes(element)
          .map((b) => b.textContent)
          .join(""),
      ),
    );
    watch.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    morph.update("$2,000");
    await wait(300);
    watch.disconnect();
    // Grouped like the target, and ending exactly on it.
    expect([...seen].some((v) => /^\$1,\d{3}$/.test(v) && v !== "$1,000")).toBe(
      true,
    );
    expect(
      boxes(element)
        .map((b) => b.textContent)
        .join(""),
    ).toBe("$2,000");
  });

  it("leaves text that isn't a figure to morph as usual", () => {
    const plugin = countup();
    expect(plugin.tween!("Saving", "Saved", { duration: 400 })).toBeNull();
  });
});

describe("skeleton", () => {
  it("holds an empty value's place with a shimmering bar, and swaps it for text", () => {
    const element = document.createElement("span");
    document.body.appendChild(element);
    const morph = new TextMorph({
      element,
      plugins: [skeleton({ length: 4 })],
      respectReducedMotion: false,
    });
    morph.update("");
    const bone = element.querySelector("[torph-kind=bone]");
    expect(bone?.textContent).toBe("\u2007".repeat(4));
    morph.update("Ada");
    expect(bone!.hasAttribute("torph-exiting")).toBe(true);
    expect(
      boxes(element)
        .map((b) => b.textContent)
        .join(""),
    ).toBe("Ada");
    morph.destroy();
  });
});

describe("magnet", () => {
  it("pushes letters near the pointer away, and lets go when it leaves", async () => {
    const { element, morph } = mount({ plugins: [magnet({ radius: 50 })] });
    morph.update("ab");
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      return this.textContent === "a"
        ? new DOMRect(0, 0, 10, 20)
        : rect.call(this);
    };
    try {
      element.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 20, clientY: 10 }),
      );
      await wait(40);
      const a = boxes(element).find((b) => b.textContent === "a")!;
      // Pushed left, away from a pointer to its right.
      expect(a.style.translate).toMatch(/^-/);
      element.dispatchEvent(new PointerEvent("pointerleave"));
      await wait(40);
      expect(a.style.translate).toBe("");
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
    morph.destroy();
    expect(element.hasAttribute("torph-magnet")).toBe(false);
  });
});

describe("weight", () => {
  it("brings letters in heavy and thins leaving ones away", () => {
    const { morph } = mount({ plugins: [weight()] });
    morph.update("ab");
    const calls = animations(() => morph.update("cb"));
    expect(
      calls
        .filter((c) => c.frames.includes('"fontWeight":"900"'))
        .map((c) => c.box.textContent),
    ).toEqual(["c"]);
    expect(
      calls
        .filter((c) => c.frames.includes('"fontWeight":"100"'))
        .map((c) => c.box.textContent),
    ).toEqual(["a"]);
  });
});

describe("redline across lines", () => {
  const rows = (element: HTMLElement) => {
    const out: string[][] = [[]];
    for (const box of Array.from(element.querySelectorAll("[torph-id]"))) {
      if (box.tagName === "BR") out.push([]);
      else
        out
          .at(-1)!
          .push(
            (box.hasAttribute("torph-lingering") ? "~" : "") + box.textContent,
          );
    }
    return out.map((r) => r.join(""));
  };

  it("keeps a removed line on its own row while it lingers", () => {
    const { element, morph } = mount({ plugins: [redline()] });
    morph.update("a\nb\nc");
    morph.update("a\nc");
    expect(rows(element)).toEqual(["a", "~b", "c"]);
  });

  it("strikes a whole removed line through, rather than letting it collapse as a group", () => {
    const { morph } = mount({ plugins: [redline()] });
    morph.update("first line here\n  return text;\nend");
    const calls = animations(() => morph.update("first line here\nend"));
    const struck = calls
      .filter((c) => c.frames.includes("#ff6b6b"))
      .map((c) => c.box.textContent);
    expect(struck).toEqual(["return", "text;"]);
  });

  it("marks an edit inside a line in place", () => {
    const { element, morph } = mount({ plugins: [redline()] });
    morph.update("a\nold line\nz");
    morph.update("a\nnew line\nz");
    expect(rows(element)).toEqual(["a", "~oldnew\u00A0line", "z"]);
  });
});

describe("at rest", () => {
  const all = {
    blur,
    words,
    scramble,
    flap,
    typewriter,
    tokens,
    odometer,
    wave,
    wipe,
    caseless,
    anagram,
    stack,
    squash,
    redline,
    countup,
    weight,
  };
  for (const [name, make] of Object.entries(all)) {
    it(`${name} settles to the value as plain text`, async () => {
      const { element, morph } = mount(
        // Linear, so a plugin's own spring doesn't outlast the wait.
        { plugins: [make()], duration: 20, ease: "linear" },
        { rest: true },
      );
      for (const value of ["$1,200 paid", "getUser\nsrc/a.ts", "Done"]) {
        morph.update(value);
        await wait(10);
      }
      await wait(1200);
      expect(element.querySelector("[torph-text]")?.textContent).toBe("Done");
      expect(element.querySelectorAll("[torph-id]").length).toBe(0);
    });
  }

  it("skeleton keeps its bone in a box, and the text at rest as plain text", async () => {
    const { element, morph } = mount(
      { plugins: [skeleton()], duration: 20 },
      { rest: true },
    );
    morph.update("");
    expect(element.querySelector('[torph-kind="bone"]')).not.toBe(null);
    morph.update("Ready");
    await wait(200);
    expect(element.querySelector("[torph-text]")?.textContent).toBe("Ready");
    morph.update("");
    await wait(200);
    expect(element.querySelector('[torph-kind="bone"]')).not.toBe(null);
  });

  it("magnet keeps a box per letter at rest", async () => {
    const { element, morph } = mount(
      { plugins: [magnet()], duration: 20 },
      { rest: true },
    );
    morph.update("hi you");
    expect(
      Array.from(element.querySelectorAll("[torph-id]"), (b) => b.textContent),
    ).toEqual(["h", "i", " ", "y", "o", "u"]);
    morph.update("hi me");
    await wait(200);
    expect(element.querySelector("[torph-text]")).toBe(null);
    expect(element.querySelectorAll("[torph-id]").length).toBe(5);
  });
});
