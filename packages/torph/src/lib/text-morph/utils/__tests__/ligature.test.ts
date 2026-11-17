// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Segment } from "../../../utils/types";
import {
  joinRuns,
  ligate,
  readShaping,
  stableRuns,
  type Shaping,
} from "../ligature";
import { segmentText } from "../segment";

// Every glyph 10px; these pairs kern as a font's table would, which must not join them.
const PAIRS: Record<string, number> = {
  AV: -3,
  VA: -3,
  To: -2,
  "T.": -4,
  "e\u0301V": -1,
  "y ": -1,
};

// Each arrow is drawn as one glyph. Chromium drops it when letter-spaced; WebKit
// and Firefox keep it and space it as the one glyph it is.
const ARROWS = new Set(["=>", "->", "<-"]);
let ligatures: "kept" | "dropped" = "kept";

let measured: string[] = [];
const getContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  measured = [];
  ligatures = "kept";
  HTMLCanvasElement.prototype.getContext = (() => ({
    font: "",
    letterSpacing: "0px",
    measureText(this: { letterSpacing: string }, text: string) {
      measured.push(text);
      const spacing = parseFloat(this.letterSpacing);
      const arrow =
        ARROWS.has(text) && !(spacing && ligatures === "dropped") ? 1 : 0;
      const glyphs = text.replace(/\p{M}/gu, "").length - arrow;
      return {
        width: glyphs * (10 + spacing) + (arrow ? 0 : (PAIRS[text] ?? 0)),
      };
    },
  })) as unknown as typeof getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
});

let fontId = 0;
// A fresh font per test, so the pair cache never answers for one.
const shaping = (over: Partial<Shaping> = {}): Shaping => ({
  font: `400 20px Test${fontId++}`,
  ligatures: true,
  // The fake ruler has no pixels to compare; the ink check has its own tests.
  contextual: false,
  ...over,
});

const seg = (id: string, string: string, kind?: Segment["kind"]): Segment =>
  kind ? { id, string, kind } : { id, string };

describe("ligate", () => {
  const strings = (segments: Segment[]) => segments.map((s) => s.string);

  it.each(["kept", "dropped"] as const)(
    "gives a ligature one box when spacing has it %s",
    (mode) => {
      ligatures = mode;
      expect(strings(ligate(segmentText("a=>b", "en"), shaping()))).toEqual([
        "a",
        "=>",
        "b",
      ]);
    },
  );

  it("leaves kerned pairs in their own boxes", () => {
    const segments = segmentText("AVA", "en");
    expect(ligate(segments, shaping())).toEqual(segments);
  });

  it("joins a run of overlapping ligatures into one box", () => {
    expect(strings(ligate(segmentText("x<->y", "en"), shaping()))).toEqual([
      "x",
      "<->",
      "y",
    ]);
  });

  it("names the box after its parts, so the same parts keep it", () => {
    const before = ligate(segmentText("a->b", "en"), shaping());
    const after = ligate(segmentText("c->d", "en"), shaping());
    expect(before[1]!.id).toBe("\u0000l-\u0000>");
    expect(after[1]!.id).toBe(before[1]!.id);
  });

  it("keeps digits in their slots", () => {
    const segments = [seg("a", "-"), seg("d", ">", "symbol")];
    expect(ligate(segments, shaping())).toEqual(segments);
  });

  it("does not join across a line break", () => {
    const segments = segmentText("-\n>", "en");
    expect(ligate(segments, shaping())).toEqual(segments);
  });

  it("joins nothing where the page turned ligatures off", () => {
    const segments = segmentText("a=>b", "en");
    expect(ligate(segments, shaping({ ligatures: false }))).toBe(segments);
  });
});

describe("readShaping", () => {
  const style = (props: Partial<CSSStyleDeclaration>) =>
    ({
      fontStyle: "normal",
      fontWeight: "400",
      fontSize: "20px",
      fontFamily: "Test",
      fontFeatureSettings: "normal",
      ...props,
    }) as CSSStyleDeclaration;

  it("reads the font a canvas needs", () => {
    expect(readShaping(style({}))).toEqual({
      font: "normal 400 20px Test",
      ligatures: true,
      contextual: true,
    });
  });

  it("stands down where the page turned ligatures off", () => {
    expect(
      readShaping(style({ fontVariantLigatures: "none" }))?.ligatures,
    ).toBe(false);
    expect(
      readShaping(
        style({ fontVariantLigatures: "no-common-ligatures no-contextual" }),
      )?.ligatures,
    ).toBe(false);
  });

  it("stands down where a canvas can't draw the page's glyphs", () => {
    expect(readShaping(style({ fontFeatureSettings: '"ss01"' }))).toBeNull();
  });

  it("stands down with no font size, and so no layout", () => {
    expect(readShaping(style({ fontSize: "" }))).toBeNull();
  });
});

describe("the pair cache", () => {
  it("measures a pair once per font", () => {
    const font = shaping();
    ligate(segmentText("AV", "en"), font);
    const first = measured.length;
    ligate(segmentText("AVAV", "en"), font);
    // "VA" is new, and measured plain and spaced; "AV" is not.
    expect(measured.length - first).toBe(6);
  });

  it("starts over rather than keep a font string for every size it has seen", () => {
    for (let size = 1; size <= 40; size++) {
      ligate(segmentText("AV", "en"), shaping({ font: `${size}px Fluid` }));
    }
    measured = [];
    ligate(segmentText("AV", "en"), shaping({ font: "1px Fluid" }));
    expect(measured).not.toHaveLength(0);
    measured = [];
    ligate(segmentText("AV", "en"), shaping({ font: "40px Fluid" }));
    expect(measured).toHaveLength(0);
  });
});

describe("joining scripts", () => {
  const strings = (segments: Segment[]) => segments.map((s) => s.string);

  it("keeps an Arabic word in one box, with no font to measure", () => {
    expect(strings(ligate(segmentText("مرحبا", "ar"), null))).toEqual([
      "مرحبا",
    ]);
  });

  it("joins even where the page turned ligatures off — joining isn't optional", () => {
    expect(
      strings(
        ligate(segmentText("مرحبا", "ar"), shaping({ ligatures: false })),
      ),
    ).toEqual(["مرحبا"]);
  });

  it("joins only letters of a joining script", () => {
    expect(strings(ligate(segmentText("abسلامcd", "ar"), null))).toEqual([
      "a",
      "b",
      "سلام",
      "c",
      "d",
    ]);
  });

  it("leaves Hebrew, which doesn't join, a box per letter", () => {
    const segments = segmentText("שלום", "he");
    expect(ligate(segments, null)).toBe(segments);
  });
});

describe("runs a morph leaves alone", () => {
  const strings = (segments: Segment[]) => segments.map((s) => s.string);
  const join = (before: Segment[], after: Segment[]) =>
    joinRuns(after, stableRuns(before, after).after);

  it("joins what didn't change around what did, within a line", () => {
    const before = segmentText("you have new mail", "en");
    const after = [
      ...before.slice(0, 4),
      { id: "old", string: "old" },
      ...before.slice(5),
    ];
    expect(strings(join(before, after).segments)).toEqual([
      "you\u00A0have",
      "\u00A0",
      "old",
      "\u00A0",
      "mail",
    ]);
  });

  it("never runs across a line break", () => {
    const before = segmentText("one two\nthree four", "en");
    expect(strings(join(before, before).segments)).toEqual([
      "one\u00A0two",
      "\n",
      "three\u00A0four",
    ]);
  });

  it("names a run after its words, so it keeps its box when spaces renumber", () => {
    const before = segmentText("a b c", "en");
    const after = before.map((s) =>
      s.string === "\u00A0" ? { ...s, id: `${s.id}-moved` } : s,
    );
    const first = join(before, before).segments[0]!;
    expect(join(before, after).segments[0]!.id).toBe(first.id);
    expect(first.id.startsWith("\u0000l")).toBe(true);
  });

  it("treats a figure that rolled as changed", () => {
    const before = [
      { id: "d1", string: "1", kind: "digit" as const },
      { id: "d2", string: "2", kind: "digit" as const },
    ];
    const after = [before[0]!, { ...before[1]!, string: "3" }];
    expect(stableRuns(before, after).after).toEqual([]);
  });

  it("keeps each run's parts, to split it back into", () => {
    const before = segmentText("a b", "en");
    const { segments, parts } = join(before, before);
    expect(parts.get(segments[0]!.id)).toEqual(before);
  });
});
