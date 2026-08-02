import { describe, it, expect } from "vitest";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";
import type { Segment } from "../segment";

/**
 * Parity with the browser test bench in `site/src/surfaces/playground-tests`.
 *
 * Every case there pairs a `verify` (pure, over `segmentText`/`diffSegments`)
 * with a `verifyDom` (positions and transforms, needs a real browser). The pure
 * half is ported here so a regression in text matching fails in CI rather than
 * waiting for someone to open the page; the DOM half stays in the browser.
 *
 * Case labels match the bench exactly. When a case is added there, add it here.
 */

const L = "en";

function segOf(segments: Segment[], value: string): Segment | undefined {
  return segments.find((s) => s.string === value);
}

function expectWordPersists(from: string, to: string, word: string) {
  const old = segmentText(from, L);
  const { segments } = diffSegments(old, to, L);
  const oldSeg = segOf(old, word);
  const newSeg = segOf(segments, word);

  expect(oldSeg, `"${word}" is not a segment of "${from}"`).toBeDefined();
  expect(newSeg, `"${word}" is not a segment of "${to}"`).toBeDefined();
  expect(newSeg!.id, `"${word}" should keep its element across the morph`).toBe(
    oldSeg!.id,
  );
}

function expectWordAbsent(from: string, to: string, word: string) {
  const { segments } = diffSegments(segmentText(from, L), to, L);
  expect(segOf(segments, word), `"${word}" should be gone`).toBeUndefined();
}

function expectCharMorph(from: string, to: string, splitWord: string) {
  const { splits } = diffSegments(segmentText(from, L), to, L);
  expect(
    splits.has(splitWord),
    `"${splitWord}" should split into per-character segments`,
  ).toBe(true);
}

function expectNoMorph(from: string, to: string) {
  const { splits } = diffSegments(segmentText(from, L), to, L);
  expect(
    [...splits.keys()],
    "nothing should split into characters",
  ).toStrictEqual([]);
}

function expectSharedGraphemes(from: string, to: string, shared: string[]) {
  const oldChars = segmentText(from, L).map((s) => s.string);
  const newChars = segmentText(to, L).map((s) => s.string);
  for (const c of shared) {
    expect(oldChars, `"${c}" should be a segment of "${from}"`).toContain(c);
    expect(newChars, `"${c}" should be a segment of "${to}"`).toContain(c);
  }
}

function expectCycleStable(a: string, b: string, word: string) {
  let prev = segmentText(a, L);
  const originalId = segOf(prev, word)?.id;
  expect(originalId, `"${word}" is not a segment of "${a}"`).toBeDefined();

  for (let i = 0; i < 4; i++) {
    const { segments } = diffSegments(prev, i % 2 === 0 ? b : a, L);
    expect(segOf(segments, word)?.id, `"${word}" changed at cycle ${i + 1}`).toBe(
      originalId,
    );
    prev = segments;
  }
}

describe("playground parity", () => {
  describe("basics", () => {
    it("Word reorder + exit", () => {
      expectWordPersists(
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      );
    });

    it("Same word, reversed order", () => {
      expectWordPersists("hello world", "world hello", "hello");
      expectWordPersists("hello world", "world hello", "world");
    });

    it("Add word", () => {
      const old = segmentText("hello", L);
      const { segments } = diffSegments(old, "hello world", L);
      const newIds = new Set(segments.map((s) => s.id));

      for (const seg of old) {
        expect(newIds, `"${seg.string}" lost its element`).toContain(seg.id);
      }
      expect(segOf(segments, "world")).toBeDefined();
    });

    it("Remove word", () => {
      expectWordPersists("hello world", "hello", "hello");
      expectWordAbsent("hello world", "hello", "world");
    });

    it("Dissimilar word replacement", () => {
      expectNoMorph("cat and dog", "fish and bird");
      expectWordPersists("cat and dog", "fish and bird", "and");
    });

    it("Multi-word persist", () => {
      expectWordPersists("the quick brown fox", "the slow brown dog", "brown");
      expectWordPersists("the quick brown fox", "the slow brown dog", "the");
    });

    it("Duplicate words", () => {
      const old = segmentText("the cat and the dog", L);
      const { segments } = diffSegments(old, "the big and the small", L);
      const oldThes = old.filter((s) => s.string === "the");
      const newThes = segments.filter((s) => s.string === "the");

      expect(oldThes).toHaveLength(2);
      expect(newThes).toHaveLength(2);
      expect(newThes[0]!.id).toBe(oldThes[0]!.id);
      expect(newThes[1]!.id).toBe(oldThes[1]!.id);
      expect(newThes[0]!.id).not.toBe(newThes[1]!.id);
      expectWordPersists("the cat and the dog", "the big and the small", "and");
    });
  });

  describe("character morph", () => {
    it("Character morph (add prefix)", () => {
      expectCharMorph("npm i torph", "pnpm i torph", "npm");
    });

    it("Character morph + word swap", () => {
      expectCharMorph("npm i torph", "pnpm add torph", "npm");
      expectWordPersists("npm i torph", "pnpm add torph", "torph");
    });

    it("Reverse character morph", () => {
      expectCharMorph("pnpm i torph", "npm i torph", "pnpm");
    });

    it("Single character change", () => {
      expectSharedGraphemes("cart", "card", ["c", "a", "r"]);
    });

    it("Case change", () => {
      expectCharMorph("Hello World", "hello world", "Hello");
    });

    it("Punctuation", () => {
      const old = segmentText("Hello, world!", L);
      const { segments } = diffSegments(old, "Hello world", L);
      const oldIds = new Set(old.map((s) => s.id));
      const persisted = segments.filter((s) => oldIds.has(s.id));

      expect(persisted.length).toBeGreaterThanOrEqual(4);
    });

    it("Numbers", () => {
      expectSharedGraphemes("$1,234", "$12,345,678", ["$", "1", ","]);
    });

    it("Long word char morph", () => {
      expectSharedGraphemes("abcdefghijklmnop", "abcmnopqrstuvwx", [
        "a",
        "b",
        "c",
        "m",
        "n",
        "o",
        "p",
      ]);
    });
  });

  describe("multiline", () => {
    it("Multiline basic", () => {
      expectWordPersists("hello\nworld", "hello\nuniverse", "hello");
    });

    it("Multiline add line", () => {
      const from = "hello world\ngoodbye";
      const to = "hello world\ngoodbye\nfarewell";
      expectWordPersists(from, to, "hello");
      expectWordPersists(from, to, "goodbye");
    });

    it("Multiline remove line", () => {
      const from = "hello world\nfoo bar\ngoodbye moon";
      const to = "hello world\ngoodbye moon";
      expectWordPersists(from, to, "hello");
      expectWordPersists(from, to, "goodbye");
      expectWordAbsent(from, to, "foo");
    });

    it("Multiline reorder", () => {
      const from = "alpha bravo\ncharlie delta";
      const to = "charlie delta\nalpha bravo";
      expectWordPersists(from, to, "alpha");
      expectWordPersists(from, to, "charlie");
    });

    it("Multiline with edits", () => {
      const from = "the quick brown fox\njumps over the lazy dog";
      const to = "the slow red fox\nleaps over the happy cat";
      expectWordPersists(from, to, "the");
      expectWordPersists(from, to, "fox");
      expectWordPersists(from, to, "over");
    });

    it("Multiline ↔ single line", () => {
      expectWordPersists("hello\nworld", "hello world", "hello");
      expectWordPersists("hello\nworld", "hello world", "world");
      expectWordPersists("hello world", "hello\nworld", "hello");
      expectWordPersists("hello world", "hello\nworld", "world");
    });

    it("Empty lines", () => {
      expectWordPersists("hello\n\nworld", "hello\nworld", "hello");
      expectWordPersists("hello\n\nworld", "hello\nworld", "world");
    });

    it("Multiline empty transition", () => {
      const r1 = diffSegments(segmentText("hello\nworld", L), "", L);
      const r2 = diffSegments([], "foo\nbar", L);

      expect(r1.segments).toStrictEqual([]);
      expect(segOf(r2.segments, "foo")).toBeDefined();
      expect(segOf(r2.segments, "bar")).toBeDefined();
      expect(r2.segments.filter((s) => s.string === "\n")).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("Empty to text", () => {
      const { segments } = diffSegments([], "hello world", L);
      const back = diffSegments(segmentText("hello world", L), "", L);

      expect(segOf(segments, "hello")).toBeDefined();
      expect(back.segments).toStrictEqual([]);
    });

    it("Single character", () => {
      expectWordAbsent("a", "b", "a");
    });

    it("Complete replacement", () => {
      expectNoMorph("abcdef", "xyz");
      expectWordAbsent("abcdef", "xyz", "abcdef");
    });

    it("Whitespace normalization", () => {
      // Ported as-is from the bench, where both sides are the same string.
      expectWordPersists("hello world", "hello world", "hello");

      // The bench's `values` cycle through a double space but its `verify`
      // never looks at one, so assert the thing the label claims: the extra
      // separator survives the morph and the words either side keep their
      // elements.
      const { segments } = diffSegments(
        segmentText("hello world", L),
        "hello  world",
        L,
      );
      const rendered = segments
        .map((s) => s.string)
        .join("")
        .replace(/ /g, " ");

      expect(rendered).toBe("hello  world");
      expectWordPersists("hello world", "hello  world", "hello");
      expectWordPersists("hello world", "hello  world", "world");
    });
  });

  describe("unicode & i18n", () => {
    it("Emoji", () => {
      expectWordPersists("Hello 👋", "Goodbye 👋", "👋");
    });

    it("Compound emoji", () => {
      expectWordPersists("Hello 👨‍👩‍👧‍👦", "Goodbye 👨‍👩‍👧‍👦", "👨‍👩‍👧‍👦");
    });

    it("Unicode accents", () => {
      expectSharedGraphemes("café", "cafe", ["c", "a", "f"]);
    });

    it("RTL text (Arabic)", () => {
      expectWordPersists("مرحبا بالعالم", "مرحبا يا صديقي", "مرحبا");
    });

    it("RTL text (Hebrew)", () => {
      expectWordPersists("שלום עולם", "שלום חברים", "שלום");
    });
  });

  describe("stress & stability", () => {
    it("Long sentence overlap", () => {
      const from = "the quick brown fox jumps over the lazy dog";
      const to = "the quick red fox leaps over the happy cat";
      expectWordPersists(from, to, "quick");
      expectWordPersists(from, to, "fox");
      expectWordPersists(from, to, "over");
    });

    it("Long paragraph", () => {
      const from =
        "The quick brown fox jumps over the lazy dog while the sun sets behind the distant mountains";
      const to =
        "The slow gray wolf runs under the bright moon while the rain falls across the nearby valleys";
      expectWordPersists(from, to, "while");
      expectWordPersists(from, to, "the");
    });

    it("Multi-cycle stability", () => {
      expectCycleStable(
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      );
    });

    it("Rapid spam (auto-cycle)", () => {
      expectCycleStable(
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      );
    });
  });
});
