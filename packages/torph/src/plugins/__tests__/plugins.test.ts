// @vitest-environment happy-dom
import { classic } from "../../lib/text-morph/plugins";
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
import { caseless } from "../caseless";
import { stack } from "../stack";
import { squash } from "../squash";
import { redline } from "../redline";
import { countup } from "../countup";
import { rows } from "../rows";
import { trend } from "../trend";
import { reveal } from "../reveal";
import { slot } from "../slot";
import { dissolve } from "../dissolve";
import { ripple } from "../ripple";
import { smoke } from "../smoke";
import { glitch } from "../glitch";
import { neon } from "../neon";
import { shatter } from "../shatter";
import { stamp } from "../stamp";
import { roll } from "../roll";
import { lookalike } from "../lookalike";
import { mask } from "../mask";
import { fadeUp } from "../fadeUp";
import { cascade } from "../cascade";
import { ticker } from "../ticker";
import { fadeThrough } from "../fadeThrough";
import { sharedAxis } from "../sharedAxis";

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
    // After torph's own set, as an author adding to it would write it.
    plugins: [
      ...(options.plugins ?? []),
      ...(rest ? [] : [held]),
      ...classic(),
    ],
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
    // Typewriter's own, not the classic scale that rides on every box.
    const delays = Object.fromEntries(
      calls
        .filter((c) => !c.frames.includes('"scale"'))
        .map((c) => [c.box.textContent, c.options.delay ?? 0]),
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
    const falls = calls.filter((c) => c.frames.includes("+ 0.6em"));
    expect(drops.length).toBe(2);
    expect(falls.length).toBe(2);
    expect(drops[1]!.options.delay).toBeGreaterThan(
      drops[0]!.options.delay ?? 0,
    );
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

describe("odometer, on a clock", () => {
  it("takes a colon as a separator, and turns the places either side", () => {
    const { element, morph } = mount({ plugins: [odometer()] });
    morph.update("04:59");
    const before = boxes(element);
    morph.update("04:58");
    expect(boxes(element)).toEqual(before);
    expect(
      before.filter((b) => b.getAttribute("torph-kind")?.startsWith("wheel-"))
        .length,
    ).toBe(4);
  });
});

describe("rows", () => {
  it("keeps each row's box by its key, wherever the row moves", () => {
    const { element, morph } = mount({
      plugins: [rows({ key: (line) => line.split(" ")[0]! })],
    });
    morph.update("Ada 30\nGrace 20\nKatherine 10");
    const [ada, grace, katherine] = boxes(element).filter(
      (b) => b.tagName !== "BR",
    );
    morph.update("Katherine 40\nAda 30\nGrace 20");
    const after = boxes(element).filter((b) => b.tagName !== "BR");
    expect(after).toEqual([katherine, ada, grace]);
    expect(after[0]!.textContent).toBe("Katherine 40");
  });
});

describe("trend", () => {
  it("flashes arriving text green as the figure rises, red as it falls", () => {
    const { morph } = mount({ plugins: [trend({ up: "lime", down: "red" })] });
    morph.update("$1,200");
    const rising = animations(() => morph.update("$1,250"));
    expect(rising.some((c) => c.frames.includes("lime"))).toBe(true);
    const falling = animations(() => morph.update("$1,100"));
    expect(falling.some((c) => c.frames.includes("red"))).toBe(true);
    expect(falling.some((c) => c.frames.includes("lime"))).toBe(false);
  });

  it("leaves text without a figure alone", () => {
    const { morph } = mount({ plugins: [trend({ up: "lime", down: "red" })] });
    morph.update("Loading");
    const calls = animations(() => morph.update("Ready"));
    expect(calls.some((c) => /lime|red/.test(c.frames))).toBe(false);
  });
});

describe("reveal", () => {
  it("keeps each place's box, and turns it over to the new character", async () => {
    const { element, morph } = mount({
      plugins: [reveal()],
      duration: 60,
    });
    morph.update("••••");
    const before = boxes(element);
    const calls = animations(() => morph.update("abcd"));
    expect(boxes(element)).toEqual(before);
    // Still the old character until its turn.
    expect(before.map((b) => b.textContent).join("")).toBe("••••");
    expect(calls.filter((c) => c.frames.includes("rotateY")).length).toBe(4);
    await wait(200);
    expect(before.map((b) => b.textContent).join("")).toBe("abcd");
  });
});

describe("slot", () => {
  it("rolls new text up into a window, and old text out of the top", () => {
    const { morph } = mount({ plugins: [slot()] });
    morph.update("one");
    const calls = animations(() => morph.update("two"));
    expect(calls.some((c) => c.frames.includes("inset(0 0 100% 0)"))).toBe(
      true,
    );
    expect(calls.some((c) => c.frames.includes("inset(100% 0 0 0)"))).toBe(
      true,
    );
  });
});

describe("dissolve", () => {
  it("thins letters out through a screen of dots", () => {
    const { morph } = mount({ plugins: [dissolve()] });
    morph.update("ab");
    const calls = animations(() => morph.update("cd"));
    expect(calls.filter((c) => c.frames.includes("maskSize")).length).toBe(4);
  });
});

describe("ripple", () => {
  it("starts each new letter later the further it is from the change", () => {
    const { morph } = mount({ plugins: [ripple()] });
    morph.update("hello world");
    const calls = animations(() => morph.update("hello there"));
    const pops = calls
      .filter((c) => c.frames.includes("scale(0.4)"))
      .map((c) => c.options.delay ?? 0);
    expect(pops.length).toBeGreaterThan(2);
    expect(pops).toEqual([...pops].sort((a, b) => a - b));
    expect(pops.at(-1)).toBeGreaterThan(pops[0]!);
  });
});

describe("smoke", () => {
  it("lets leaving letters rise apart, each its own way", () => {
    const { morph } = mount({ plugins: [smoke()] });
    morph.update("abc");
    const calls = animations(() => morph.update("xyz"));
    const wisps = calls.filter((c) => c.frames.includes("skewX"));
    expect(wisps.length).toBe(3);
    expect(new Set(wisps.map((c) => c.frames)).size).toBe(3);
  });
});

describe("glitch", () => {
  it("cuts between sliced bands rather than easing", () => {
    const { morph } = mount({ plugins: [glitch()] });
    morph.update("one");
    const calls = animations(() => morph.update("two"));
    const cuts = calls.filter((c) => c.frames.includes("inset("));
    expect(cuts.length).toBeGreaterThan(0);
    expect(cuts[0]!.frames).toContain("steps(1, end)");
  });
});

describe("neon", () => {
  it("flickers new text on with a glow", () => {
    const { morph } = mount({ plugins: [neon()] });
    morph.update("OPEN");
    const calls = animations(() => morph.update("SHUT"));
    expect(
      calls.some(
        (c) => c.frames.includes("textShadow") && c.frames.includes("steps"),
      ),
    ).toBe(true);
  });
});

describe("shatter", () => {
  it("drops shards in a leaving box's place, and clears them when interrupted", () => {
    const { element, morph } = mount({ plugins: [shatter()] });
    morph.update("one");
    morph.update("two");
    const shards = Array.from(
      element.querySelectorAll<HTMLElement>("[aria-hidden]"),
    ).filter((el) => el.style.clipPath.startsWith("polygon"));
    // Four for every box that leaves or arrives.
    expect(shards.length).toBeGreaterThan(0);
    expect(shards.length % 4).toBe(0);
    expect(shards.every((el) => !el.hasAttribute("torph-id"))).toBe(true);
    morph.update("three");
    expect(shards.every((el) => !el.isConnected)).toBe(true);
  });
});

describe("stamp", () => {
  it("slams new text down and shakes the line once", () => {
    const { element, morph } = mount({ plugins: [stamp()] });
    morph.update("Pending");
    const calls = animations(() => morph.update("Pending Paid Done"));
    expect(calls.some((c) => c.frames.includes("scale(1.8)"))).toBe(true);
    expect(calls.filter((c) => c.box === element).length).toBe(1);
  });
});

describe("roll", () => {
  it("turns the whole value over like a barrel face", () => {
    const { element, morph } = mount({ plugins: [roll()] });
    morph.update("Monday");
    const calls = animations(() => morph.update("Tuesday"));
    expect(element.querySelectorAll('[torph-kind="face"]').length).toBe(2);
    expect(calls.some((c) => c.frames.includes("rotateX(-90deg)"))).toBe(true);
    expect(calls.some((c) => c.frames.includes("rotateX(90deg)"))).toBe(true);
  });
});

describe("lookalike", () => {
  it("keeps each place's box and steps it through lookalikes to the new letter", async () => {
    const { element, morph } = mount({ plugins: [lookalike({ rate: 5 })] });
    morph.update("IDLE");
    const before = boxes(element);
    const seen = new Set<string>();
    const observer = new MutationObserver(() =>
      seen.add(before[0]!.textContent ?? ""),
    );
    observer.observe(before[0]!, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    morph.update("BUSY");
    expect(boxes(element)).toEqual(before);
    await wait(100);
    observer.disconnect();
    expect(before.map((b) => b.textContent).join("")).toBe("BUSY");
    // I to B is two families apart, so it passes through a glyph of each on the way.
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("mask", () => {
  it("rises what arrives inside a still mask, and leaves what stays", () => {
    const { element, morph } = mount({ plugins: [mask()] });
    morph.update("one two\nthree");
    const calls = animations(() => morph.update("one six\nthree"));
    expect(element.querySelectorAll("[torph-slot]").length).toBeGreaterThan(0);
    // The text moves inside its mask; the mask itself isn't tipped.
    const rises = calls.filter((c) => c.frames.includes("rotateX(-45deg)"));
    expect(rises.length).toBeGreaterThan(0);
    expect(
      rises.every((c) => c.box.parentElement!.hasAttribute("torph-slot")),
    ).toBe(true);
    expect(rises.some((c) => /one|three/.test(c.box.textContent ?? ""))).toBe(
      false,
    );
    expect(calls.some((c) => c.frames.includes("rotateX(45deg)"))).toBe(true);
  });

  it("splits as torph does, so a word keeps the letters it shares", () => {
    const { morph } = mount({ plugins: [mask()] });
    morph.update("Ship it Tuesday");
    const calls = animations(() => morph.update("Ship it Thursday"));
    const risen = calls
      .filter((c) => c.frames.includes("rotateX(-45deg)"))
      .map((c) => c.box.textContent)
      .sort();
    // Tuesday → Thursday keeps T, u, s, d, a and y; only h and r are new.
    expect(risen).toEqual(["h", "r"]);
  });

  it("drops in from above when the figure goes down, under from: auto", () => {
    const { morph } = mount({ plugins: [mask({ from: "auto" })] });
    morph.update("Step 3 · Payment");
    const back = animations(() => morph.update("Step 2 · Details"));
    expect(
      back.some(
        (c) =>
          c.frames.includes("rotateX(45deg)") && c.frames.includes("50% 100%"),
      ),
    ).toBe(true);
    morph.update("Step 3 · Payment");
    const on = animations(() => morph.update("Step 4 · Done"));
    expect(
      on.some(
        (c) =>
          c.frames.includes("rotateX(-45deg)") && c.frames.includes("50% 0"),
      ),
    ).toBe(true);
  });

  it("asks a from function each morph, without rebuilding", () => {
    let side: "left" | "right" = "right";
    const asked: string[] = [];
    const { morph } = mount({
      plugins: [
        mask({
          from: ({ to }) => {
            asked.push(to);
            return side;
          },
        }),
      ],
    });
    morph.update("Monday");
    const right = animations(() => morph.update("Friday"));
    side = "left";
    const left = animations(() => morph.update("Sunday"));
    expect(asked).toEqual(["Friday", "Sunday"]);
    expect(right.some((c) => c.frames.includes("translateX(calc(100%"))).toBe(
      true,
    );
    expect(left.some((c) => c.frames.includes("translateX(calc(-100%"))).toBe(
      true,
    );
  });

  it("comes in sideways inside a mask clipped at the box's sides too", () => {
    const { morph } = mount({ plugins: [mask({ from: "right" })] });
    morph.update("Monday");
    const calls = animations(() => morph.update("Friday"));
    expect(calls.some((c) => c.frames.includes("translateX(calc(100%"))).toBe(
      true,
    );
    expect(calls.some((c) => c.frames.includes("inset(0 0 0 0)"))).toBe(true);
  });

  it("staggers whole lines under cascade: line", () => {
    const { morph } = mount({ plugins: [mask({ cascade: "line" })] });
    morph.update("a\nb");
    const calls = animations(() => morph.update("x\ny"));
    const delays = calls
      .filter((c) => c.frames.includes("rotateX(-45deg)"))
      .map((c) => c.options.delay ?? 0);
    expect(delays).toEqual([0.25 * 40, (0.25 + 0.12) * 40]);
  });

  it("moves old and new together with no head start", () => {
    const { morph } = mount({ plugins: [mask({ clear: 0 })] });
    morph.update("one");
    const calls = animations(() => morph.update("two"));
    const arrive = calls.filter((c) => c.frames.includes("rotateX(-45deg)"));
    const leave = calls.filter((c) => c.frames.includes("rotateX(45deg)"));
    expect(Math.min(...arrive.map((c) => c.options.delay ?? 0))).toBe(0);
    expect(leave.length).toBeGreaterThan(0);
    expect(leave.every((c) => c.options.duration === 40)).toBe(true);
  });
});

describe("fadeUp", () => {
  it("fades new text up in turn, and old text out at once", () => {
    const { morph } = mount({ plugins: [fadeUp()] });
    morph.update("Welcome");
    const calls = animations(() => morph.update("Good to see you"));
    const rises = calls.filter((c) => c.frames.includes("+ 0.35em"));
    expect(rises.length).toBeGreaterThan(1);
    expect(rises.at(-1)!.options.delay).toBeGreaterThan(
      rises[0]!.options.delay ?? 0,
    );
    expect(
      calls
        .filter((c) => c.frames.includes('"opacity":0,"offset":1'))
        .every((c) => !c.options.delay),
    ).toBe(true);
  });
});

describe("cascade", () => {
  it("starts each line after the one above", () => {
    const { morph } = mount({ plugins: [cascade()] });
    morph.update("a\nb\nc");
    const calls = animations(() => morph.update("x\ny\nz"));
    const delays = calls
      .filter((c) => c.frames.includes("+ 0.35em"))
      .map((c) => [c.box.textContent, c.options.delay ?? 0]);
    expect(delays).toEqual([
      ["x", 0],
      ["y", 0.15 * 40],
      ["z", 0.3 * 40],
    ]);
  });
});

describe("ticker", () => {
  it("is mask with nothing tipped or held back", () => {
    const { morph } = mount({ plugins: [ticker()] });
    morph.update("Syncing");
    const calls = animations(() => morph.update("Synced"));
    const moves = calls.filter((c) => c.frames.includes("perspective"));
    expect(moves.length).toBeGreaterThan(0);
    expect(
      moves.every(
        (c) =>
          c.frames.includes("rotateX(0deg)") ||
          c.frames.includes("rotateX(-0deg)"),
      ),
    ).toBe(true);
    expect(moves.every((c) => !c.options.delay)).toBe(true);
  });
});

describe("fadeThrough", () => {
  it("fades the old out before the new grows in", () => {
    const { morph } = mount({ plugins: [fadeThrough()] });
    morph.update("Inbox");
    const calls = animations(() => morph.update("Drafts"));
    const grow = calls.find((c) => c.frames.includes("scale(0.92)"));
    expect(grow?.options.delay).toBeCloseTo(0.35 * 40);
  });
});

describe("sharedAxis", () => {
  it("goes forward with the figure, and back against it", () => {
    const { morph } = mount({ plugins: [sharedAxis()] });
    morph.update("Step 1 · Account");
    const forward = animations(() => morph.update("Step 2 · Profile"));
    expect(
      forward.some(
        (c) => c.frames.includes("* 1)") && c.frames.includes('"opacity":0'),
      ),
    ).toBe(true);
    const back = animations(() => morph.update("Step 1 · Account"));
    expect(
      back.some(
        (c) => c.frames.includes("* -1)") && c.frames.includes('"opacity":0'),
      ),
    ).toBe(true);
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
    caseless,
    stack,
    squash,
    redline,
    countup,
    rows,
    trend,
    reveal,
    slot,
    dissolve,
    ripple,
    smoke,
    glitch,
    neon,
    shatter,
    stamp,
    roll,
    lookalike,
    mask,
    fadeUp,
    cascade,
    ticker,
    fadeThrough,
    sharedAxis,
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
});
