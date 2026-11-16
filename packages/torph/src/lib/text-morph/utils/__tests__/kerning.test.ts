// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Segment } from "../../../utils/types";
import { kernSegments, readKerning, type Kerning } from "../kerning";
import { segmentText } from "../segment";

// Every glyph 10px; these pairs kern as a font's table would.
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
const kerning = (over: Partial<Kerning> = {}): Kerning => ({
  font: `400 20px Test${fontId++}`,
  fontSize: 20,
  numerals: true,
  kern: true,
  ...over,
});

const seg = (id: string, string: string, kind?: Segment["kind"]): Segment =>
  kind ? { id, string, kind } : { id, string };

describe("kernSegments", () => {
  it("gives the left box of each kerned pair its kerning, in em", () => {
    const gaps = kernSegments(segmentText("AVAT.", "en"), kerning());
    expect(Object.fromEntries(gaps)).toEqual({
      A: -0.15,
      V: -0.15,
      // "AT" has no pair, so the second A gets nothing.
      T: -0.2,
    });
  });

  it("measures only the glyphs that meet, so a word kerns like a letter", () => {
    const gaps = kernSegments(
      [seg("w1", "Today"), seg("s", "\u00A0"), seg("w2", "x")],
      kerning(),
    );
    // A no-break space is measured as the space it stands in for.
    expect(Object.fromEntries(gaps)).toEqual({ w1: -0.05 });
    expect(measured).toContain("y ");
    expect(measured.some((text) => text.includes("Today"))).toBe(false);
  });

  it("keeps a combining mark with its base letter", () => {
    const gaps = kernSegments([seg("e", "e\u0301"), seg("V", "V")], kerning());
    expect(gaps.get("e")).toBeCloseTo(-0.05);
  });

  it.each(["kept", "dropped"] as const)(
    "does not mistake a ligature for kerning when spacing has it %s",
    (mode) => {
      ligatures = mode;
      const gaps = kernSegments(segmentText("a=>b", "en"), kerning());
      expect(gaps.size).toBe(0);
    },
  );

  it("does not kern across a line break", () => {
    const gaps = kernSegments(segmentText("A\nV", "en"), kerning());
    expect(gaps.size).toBe(0);
  });

  it("leaves digits alone when the numerals are not the font's defaults", () => {
    const segments = [seg("T", "T"), seg("d", ".", "symbol")];
    expect(kernSegments(segments, kerning({ numerals: false })).size).toBe(0);
    expect(kernSegments(segments, kerning()).get("T")).toBe(-0.2);
  });

  it("measures a pair once per font", () => {
    const k = kerning();
    kernSegments(segmentText("AV", "en"), k);
    const first = measured.length;
    kernSegments(segmentText("AVAV", "en"), k);
    // "VA" is new, and measured plain and spaced; "AV" is not.
    expect(measured.length - first).toBe(6);
  });

  it("does nothing without a kerning to apply", () => {
    expect(kernSegments(segmentText("AV", "en"), null).size).toBe(0);
    expect(
      kernSegments(segmentText("AV", "en"), kerning({ kern: false })).size,
    ).toBe(0);
    expect(measured).toHaveLength(0);
  });
});

describe("readKerning", () => {
  const style = (props: Partial<CSSStyleDeclaration>) =>
    ({
      fontStyle: "normal",
      fontWeight: "400",
      fontSize: "20px",
      fontFamily: "Test",
      fontKerning: "auto",
      fontFeatureSettings: "normal",
      fontVariantNumeric: "normal",
      ...props,
    }) as CSSStyleDeclaration;

  it("reads the font a canvas needs", () => {
    expect(readKerning(style({}))).toEqual({
      font: "normal 400 20px Test",
      fontSize: 20,
      numerals: true,
      kern: true,
    });
  });

  it("stands down where the page turned kerning off", () => {
    expect(readKerning(style({ fontKerning: "none" }))?.kern).toBe(false);
  });

  it("stands down where a canvas can't draw the page's glyphs", () => {
    expect(readKerning(style({ fontFeatureSettings: '"ss01"' }))).toBeNull();
  });

  it("stands down with no font size to scale by", () => {
    expect(readKerning(style({ fontSize: "" }))).toBeNull();
  });

  it("flags non-default numerals", () => {
    expect(
      readKerning(style({ fontVariantNumeric: "tabular-nums" }))?.numerals,
    ).toBe(false);
  });
});

describe("the pair cache", () => {
  it("starts over rather than keep a font string for every size it has seen", () => {
    for (let size = 1; size <= 40; size++) {
      kernSegments(
        segmentText("AV", "en"),
        kerning({ font: `${size}px Fluid` }),
      );
    }
    measured = [];
    kernSegments(segmentText("AV", "en"), kerning({ font: "1px Fluid" }));
    expect(measured).not.toHaveLength(0);
    measured = [];
    kernSegments(segmentText("AV", "en"), kerning({ font: "40px Fluid" }));
    expect(measured).toHaveLength(0);
  });
});
