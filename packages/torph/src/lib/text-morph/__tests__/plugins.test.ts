// @vitest-environment happy-dom
import { classic, fade } from "../plugins";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TextMorph } from "../index";
import { MorphController } from "../controller";
import type { TorphPlugin } from "../plugin";
import type { TextMorphOptions } from "../types";
import { ATTR_EXITING, ATTR_SLOT } from "../../utils/constants";

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
    duration: 30,
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

describe("animate overrides", () => {
  it("hands plain text to a plugin's hooks, and keeps the engine's for the rest", () => {
    const calls: string[] = [];
    const plugin: TorphPlugin = {
      name: "spy",
      animate: { text: { enter: (_box, ctx) => void calls.push(ctx.kind) } },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("hello");
    morph.update("hello world");
    // Only the boxes that arrived, and never a persisting one.
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls)).toEqual(new Set(["text"]));
  });

  it("leaves numbers to their own plugin", () => {
    const calls: string[] = [];
    const plugin: TorphPlugin = {
      name: "spy",
      animate: { text: { enter: (_box, ctx) => void calls.push(ctx.kind) } },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("$5");
    morph.update("$10");
    expect(calls).toEqual([]);
  });
});

describe("what a hook returns", () => {
  it("removes a leaving box once its returned animations finish", async () => {
    const plugin: TorphPlugin = {
      name: "fade",
      animate: {
        text: {
          exit: (box, { duration }) => [
            box.animate({ opacity: 0, offset: 1 }, { duration, fill: "both" }),
          ],
        },
      },
    };
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("one");
    morph.update("two");
    // "o" survives; "n" and "e" leave.
    expect(element.querySelectorAll(`[${ATTR_EXITING}]`).length).toBe(2);
    await wait(120);
    expect(element.querySelectorAll(`[${ATTR_EXITING}]`).length).toBe(0);
  });

  it("removes a leaving box whose hook returned nothing, once its own animations end", async () => {
    const plugin: TorphPlugin = {
      name: "quiet",
      animate: {
        text: {
          exit: (box, { duration }) =>
            void box.animate({ opacity: 0, offset: 1 }, { duration }),
        },
      },
    };
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("one");
    morph.update("two");
    await wait(120);
    expect(element.querySelectorAll(`[${ATTR_EXITING}]`).length).toBe(0);
  });

  it("holds the morph open until a returned promise settles", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const done: string[] = [];
    const plugin: TorphPlugin = {
      name: "hold",
      animate: { text: { enter: () => held } },
    };
    const { morph } = mount({
      plugins: [plugin],
      onAnimationComplete: () => done.push("complete"),
    });
    morph.update("a");
    morph.update("ab");
    await wait(120);
    expect(done).toEqual([]);
    release();
    await wait(30);
    expect(done).toEqual(["complete"]);
  });

  it("aborts a morph's signal when the next one interrupts it", () => {
    const signals: AbortSignal[] = [];
    const plugin: TorphPlugin = {
      name: "listen",
      animate: {
        text: { enter: (_box, { signal }) => void signals.push(signal) },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("a");
    morph.update("ab");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => !s.aborted)).toBe(true);
    morph.update("abc");
    expect(signals[0]!.aborted).toBe(true);
  });

  it("aborts it on teardown", () => {
    const signals: AbortSignal[] = [];
    const plugin: TorphPlugin = {
      name: "listen",
      animate: {
        text: { enter: (_box, { signal }) => void signals.push(signal) },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("a");
    morph.update("ab");
    morph.destroy();
    expect(signals[0]!.aborted).toBe(true);
  });
});

describe("claims", () => {
  it("lets an author's plugin claim words before the built-ins", () => {
    const plugin: TorphPlugin = {
      name: "whole",
      claim: () => true,
      segment: (word, { id }) => [{ id: id(word), string: word }],
    };
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("$5 off");
    // One box per word, and the figure never became a number's slots.
    expect(element.querySelectorAll(`[${ATTR_SLOT}]`).length).toBe(0);
    expect(
      Array.from(element.querySelectorAll("[torph-id]")).map(
        (b) => b.textContent,
      ),
    ).toEqual(["$5", " ", "off"]);
  });
});

describe("wrapper identity", () => {
  it("keys plugins by name and key, not by object", () => {
    const blur = (amount: number): TorphPlugin => ({
      name: "blur",
      key: String(amount),
    });
    const controller = new MorphController();
    controller.attach(document.createElement("span"), { plugins: [blur(4)] });
    expect(controller.needsRecreate({ plugins: [blur(4)] })).toBe(false);
    expect(controller.needsRecreate({ plugins: [blur(6)] })).toBe(true);
    controller.destroy();
  });
});

describe("a plugin's own kinds", () => {
  it("draws its segments with its own slot and moves them with its own hooks", () => {
    const entered: string[] = [];
    const tags: TorphPlugin = {
      name: "tags",
      claim: (word) => word.startsWith("#"),
      segment: (word, { id }) => [{ id: id(word), string: word, kind: "tag" }],
      kinds: {
        tag: {
          slot: true,
          enter: (box, ctx) =>
            void entered.push(`${ctx.kind}:${box.textContent}`),
        },
      },
    };
    const { element, morph } = mount({ plugins: [tags] });
    morph.update("hello");
    morph.update("hello #torph");
    expect(entered).toEqual(["tag:#torph"]);
    const slot = element.querySelector(`[${ATTR_SLOT}]`)!;
    expect(slot.getAttribute("torph-kind")).toBe("tag");
    expect(slot.firstElementChild?.textContent).toBe("#torph");
  });
});

describe("a slot", () => {
  it("is masked by the engine, numbers() or not, and knows how far to travel to clear it", () => {
    let clear = 0;
    let height = 0;
    const plugin: TorphPlugin = {
      name: "slotted",
      claim: () => true,
      segment: (word, { id }) => [{ id: id(word), string: word, kind: "s" }],
      kinds: {
        s: {
          slot: true,
          ink: "gy",
          enter: (_box, { line }) => {
            clear = line.clear;
            height = line.height;
          },
        },
      },
    };
    const element = document.createElement("span");
    document.body.appendChild(element);
    const morph = new TextMorph({
      element,
      duration: 30,
      respectReducedMotion: false,
      plugins: [plugin, held],
    });
    mounted.push(morph);
    morph.update("one");
    morph.update("one two");
    expect(
      element.querySelector('[torph-kind="s"][torph-slot]'),
    ).not.toBeNull();
    expect(height).toBeGreaterThan(0);
    expect(clear).toBeGreaterThanOrEqual(height);
  });
});

describe("a plugin's ease", () => {
  function durations(options: Partial<TextMorphOptions>) {
    const seen: number[] = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, frames, opts) {
      seen.push(Number((opts as KeyframeAnimationOptions)?.duration));
      return animate.call(this, frames, opts);
    };
    try {
      const { morph } = mount({ duration: undefined, ...options });
      morph.update("ab");
      morph.update("abc");
    } finally {
      Element.prototype.animate = animate;
    }
    return seen;
  }
  const springy: TorphPlugin = {
    name: "springy",
    ease: { stiffness: 265, damping: 26 },
  };

  it("times the morph when the author chose no ease", () => {
    expect(durations({ plugins: [springy] })).toContain(521);
  });

  it("gives way to the author's own", () => {
    const seen = durations({ plugins: [springy], ease: "ease-in" });
    expect(seen).not.toContain(521);
    expect(seen).toContain(400);
  });
});

describe("what a hook knows about the rest of the morph", () => {
  it("numbers each side in reading order, and counts both", () => {
    const seen: string[] = [];
    const plugin: TorphPlugin = {
      name: "order",
      animate: {
        text: {
          enter: (box, c) =>
            void seen.push(
              `+${box.textContent}${c.index}/${c.arriving}/${c.leaving}`,
            ),
          exit: (box, c) =>
            void seen.push(
              `-${box.textContent}${c.index}/${c.arriving}/${c.leaving}`,
            ),
        },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("abc");
    morph.update("axyc");
    // "b" leaves; "x" and "y" arrive in its gap.
    expect(seen).toEqual(["+x0/2/1", "+y1/2/1", "-b0/2/1"]);
  });

  it("pairs an arriving box with the one it replaces", () => {
    const pairs: string[] = [];
    const plugin: TorphPlugin = {
      name: "pairs",
      animate: {
        text: {
          enter: (box, c) =>
            void pairs.push(`${c.replaces?.textContent}>${box.textContent}`),
          exit: (box, c) =>
            void pairs.push(`${box.textContent}<${c.replacedBy?.textContent}`),
        },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("cat");
    morph.update("cut");
    expect(pairs).toEqual(["a>u", "a<u"]);
  });
});

describe("decorations", () => {
  it("run alongside the hook that moves a box, numbers included", () => {
    const decorated: string[] = [];
    const plugin: TorphPlugin = {
      name: "mark",
      decorate: {
        "*": {
          enter: (box, c) =>
            void decorated.push(`${c.kind}:${box.textContent}`),
        },
      },
    };
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("$5 a");
    morph.update("$6 ab");
    expect(decorated).toEqual(["digit:6", "text:b"]);
    // The number still moved with its own plugin: its slot is there.
    expect(element.querySelector(`[${ATTR_SLOT}]`)).not.toBeNull();
  });

  it("run for each box of a run that moves as one shape", () => {
    const decorated: string[] = [];
    const plugin: TorphPlugin = {
      name: "mark",
      decorate: {
        "*": {
          enter: (box, c) =>
            void decorated.push(
              `${box.textContent}:${c.index}/${c.arriving}${c.run ? " run" : ""}`,
            ),
          exit: (box) => void decorated.push(`-${box.textContent}`),
        },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("abcdefghij");
    morph.update("klmnopqrst");
    // groups() moved each side as one shape; every box was still decorated.
    expect(decorated.filter((d) => d.startsWith("-")).length).toBe(10);
    expect(decorated.filter((d) => !d.startsWith("-")).length).toBe(10);
    expect(decorated).toContain("t:9/10 run");
  });
});

describe("runs handed back", () => {
  it("lets a plugin keep a long replaced run letter by letter", () => {
    let entered = 0;
    const plugin: TorphPlugin = {
      name: "keep",
      runs: { claim: () => true },
      animate: { text: { enter: () => void entered++ } },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("abcdefghij");
    morph.update("klmnopqrst");
    // Every letter is new, and each arrived through its own hook rather than as one group.
    expect(entered).toBe(10);
  });
});

describe("ctx.was", () => {
  it("tells a staying box what it read before the morph, and skips one that didn't change", () => {
    const seen: string[] = [];
    const positional: TorphPlugin = {
      name: "places",
      claim: () => true,
      segment: (word, { previous, id }) =>
        Array.from(word, (letter, i) => ({
          id: previous?.[i]?.id ?? id(),
          string: letter,
        })),
      affinity: () => 1,
      animate: {
        text: {
          persist: (box, c) => void seen.push(`${c.was}>${box.textContent}`),
        },
      },
    };
    const { morph } = mount({ plugins: [positional] });
    morph.update("cat");
    morph.update("cut");
    // "c" and "t" neither moved nor changed, so their hook isn't called.
    expect(seen).toEqual(["a>u"]);
  });
});

describe("maxShift", () => {
  it("makes a word that would travel too far leave and arrive instead", () => {
    const { element, morph } = mount({
      plugins: [{ name: "near", maxShift: 3 }],
    });
    morph.update("Processing Transaction");
    const before = Array.from(element.querySelectorAll("[torph-id]"));
    morph.update("Transaction Safe");
    const kept = Array.from(
      element.querySelectorAll("[torph-id]:not([torph-exiting])"),
    ).filter((box) => before.includes(box));
    // "Transaction" moved eleven characters, so none of its old boxes stayed.
    expect(kept).toEqual([]);
  });

  it("leaves a word that moves a little to slide", () => {
    const { element, morph } = mount({
      plugins: [{ name: "near", maxShift: 3 }],
    });
    morph.update("a Transaction");
    const word = Array.from(element.querySelectorAll("[torph-id]")).find(
      (box) => box.textContent === "Transaction",
    );
    morph.update("an Transaction");
    expect(element.contains(word!)).toBe(true);
    expect(word!.hasAttribute("torph-exiting")).toBe(false);
  });
});

describe("fold", () => {
  it("keeps a letter's box when only its case changes", () => {
    const { element, morph } = mount({
      plugins: [
        {
          name: "lower",
          fold: (c) => c.toLowerCase(),
          affinity: (a, b) => (a.toLowerCase() === b.toLowerCase() ? 1 : null),
        },
      ],
    });
    morph.update("hello");
    const before = Array.from(element.querySelectorAll("[torph-id]"));
    morph.update("HELLO");
    const after = Array.from(
      element.querySelectorAll("[torph-id]:not([torph-exiting])"),
    );
    expect(after.map((b) => b.textContent).join("")).toBe("HELLO");
    expect(after).toEqual(before);
  });
});

describe("an author's override of a built-in kind", () => {
  it("comes before the built-in's own hooks", () => {
    const entered: string[] = [];
    const plugin: TorphPlugin = {
      name: "mine",
      animate: {
        digit: { enter: (box) => void entered.push(box.textContent!) },
      },
    };
    const { morph } = mount({ plugins: [plugin] });
    morph.update("$5");
    morph.update("$6");
    expect(entered).toEqual(["6"]);
  });
});

describe("whole", () => {
  it("lets a plugin cut the whole value, reusing what it likes", () => {
    const seen: number[] = [];
    const plugin: TorphPlugin = {
      name: "one",
      whole: (value, { previous, id }) => {
        seen.push(previous.length);
        return [{ id: previous[0]?.id ?? id(), string: value }];
      },
    };
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("first");
    const box = element.querySelector("[torph-id]");
    morph.update("second value");
    expect(seen).toEqual([0, 1]);
    expect(element.querySelector("[torph-id]:not([torph-exiting])")).toBe(box);
    expect(box!.textContent).toBe("second value");
  });
});

describe("linger", () => {
  const plugin: TorphPlugin = {
    name: "hold",
    linger: 2,
    claim: () => true,
    segment: (word, { id }) => [{ id: id(word), string: word }],
  };
  const order = (element: HTMLElement) =>
    Array.from(element.querySelectorAll("[torph-id]")).map(
      (b) => (b.hasAttribute("torph-lingering") ? "~" : "") + b.textContent,
    );

  it("keeps leaving text in the line, with what arrives after it", () => {
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("hello world");
    morph.update("hello there");
    expect(order(element)).toEqual(["hello", " ", "~world", "there"]);
    const lingering = element.querySelector<HTMLElement>("[torph-lingering]")!;
    // In the line: not taken out of flow the way a leaving box usually is.
    expect(lingering.style.position).toBe("");
  });

  it("closes the line up once the linger is over", async () => {
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("hello world");
    morph.update("hello there");
    await wait(30 * 2 + 40);
    expect(element.querySelector("[torph-lingering]")).toBeNull();
  });

  it("takes lingering text out at once when the next change comes", () => {
    const { element, morph } = mount({ plugins: [plugin] });
    morph.update("hello world");
    morph.update("hello there");
    morph.update("hello again");
    const left = Array.from(
      element.querySelectorAll<HTMLElement>("[torph-exiting]"),
    );
    const world = left.find((b) => b.textContent === "world")!;
    expect(world.hasAttribute("torph-lingering")).toBe(false);
    expect(world.style.position).toBe("absolute");
  });
});

describe("tween", () => {
  const steps: TorphPlugin = {
    name: "steps",
    tween: (_from, to) => [
      { value: "2", at: 0 },
      { value: "3", at: 20 },
      { value: to, at: 40 },
    ],
  };

  it("morphs through each value, telling a reader only where it's going", async () => {
    const calls: string[] = [];
    const { element, morph } = mount({
      plugins: [steps],
      onAnimationStart: () => calls.push("start"),
      onAnimationComplete: () => calls.push("complete"),
      onAnimationCancel: () => calls.push("cancel"),
    });
    morph.update("1");
    const shown: string[] = [];
    const watch = new MutationObserver(() =>
      shown.push(
        Array.from(element.querySelectorAll("[torph-id]:not([torph-exiting])"))
          .map((b) => b.textContent)
          .join(""),
      ),
    );
    watch.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    morph.update("4");
    expect(element.querySelector("[torph-sr]")!.textContent).toBe("4");
    await wait(250);
    watch.disconnect();
    expect(shown).toEqual(expect.arrayContaining(["2", "3", "4"]));
    expect(calls).toEqual(["start", "complete"]);
  });

  it("cancels the rest of the tween when the value changes again", async () => {
    const calls: string[] = [];
    const { element, morph } = mount({
      plugins: [steps],
      onAnimationComplete: () => calls.push("complete"),
      onAnimationCancel: () => calls.push("cancel"),
    });
    morph.update("1");
    morph.update("4");
    await wait(5);
    morph.update("9");
    await wait(250);
    expect(calls).toEqual(["cancel", "complete"]);
    const live = Array.from(
      element.querySelectorAll("[torph-id]:not([torph-exiting])"),
    );
    expect(live.map((b) => b.textContent).join("")).not.toBe("4");
  });
});

describe("ambient animations", () => {
  it("doesn't hold a morph open for an endless one", async () => {
    const done: string[] = [];
    const plugin: TorphPlugin = {
      name: "loop",
      animate: {
        text: {
          enter: (box) =>
            void box.animate([{ opacity: 1 }, { opacity: 0.5 }], {
              duration: 100,
              iterations: Infinity,
            }),
        },
      },
    };
    const { morph } = mount({
      plugins: [plugin],
      onAnimationComplete: () => done.push("complete"),
    });
    morph.update("a");
    morph.update("ab");
    await wait(150);
    expect(done).toEqual(["complete"]);
  });
});

describe("boxes", () => {
  it("keeps the value in boxes at rest while a plugin asks", async () => {
    const plugin: TorphPlugin = {
      name: "keep",
      boxes: (value) => value.startsWith("box"),
    };
    const { element, morph } = mount({ plugins: [plugin] }, { rest: true });
    morph.update("box it");
    expect(element.querySelector("[torph-text]")).toBe(null);
    expect(element.querySelectorAll("[torph-id]").length).toBe(3);
    morph.update("text");
    await wait(120);
    expect(element.querySelector("[torph-text]")?.textContent).toBe("text");
    morph.update("box again");
    await wait(120);
    expect(element.querySelector("[torph-text]")).toBe(null);
    expect(
      Array.from(element.querySelectorAll("[torph-id]"), (b) => b.textContent),
    ).toEqual(["box", "\u00A0", "again"]);
  });
});

describe("the plugin list", () => {
  const bare = (plugins?: TorphPlugin[]) => {
    const element = document.createElement("span");
    document.body.appendChild(element);
    const morph = new TextMorph({
      element,
      duration: 30,
      respectReducedMotion: false,
      ...(plugins ? { plugins } : {}),
    });
    mounted.push(morph);
    return { element, morph };
  };

  it("is torph's classic set when it isn't given", () => {
    const { element, morph } = bare();
    morph.update("$1");
    morph.update("$2");
    expect(element.querySelector(`[${ATTR_SLOT}]`)).not.toBeNull();
  });

  it("replaces the classic set when it is", () => {
    const { element, morph } = bare([fade()]);
    morph.update("$1");
    morph.update("$2");
    expect(element.querySelector(`[${ATTR_SLOT}]`)).toBeNull();
  });

  it("is the engine alone when empty: arrivals appear, leavers go, stayers still slide", () => {
    const { element, morph } = bare([]);
    morph.update("hello world");
    const calls: Element[] = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args) {
      calls.push(this);
      return animate.apply(this, args);
    } as typeof Element.prototype.animate;
    try {
      morph.update("hello there");
    } finally {
      Element.prototype.animate = animate;
    }
    const there = Array.from(
      element.querySelectorAll<HTMLElement>("[torph-id]"),
    ).find((b) => b.textContent === "there")!;
    expect(calls).not.toContain(there);
    expect(element.querySelector(`[${ATTR_EXITING}]`)).toBeNull();
  });
});
