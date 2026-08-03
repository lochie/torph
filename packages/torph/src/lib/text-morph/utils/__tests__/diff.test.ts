import { describe, it, expect } from "vitest";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";
import type { Segment } from "../segment";

function ids(segments: Segment[]): string[] {
  return segments.map((s) => s.id);
}

function strings(segments: Segment[]): string[] {
  return segments.map((s) => s.string);
}

/**
 * ID of the segment covering the first occurrence of `needle` in the rendered
 * text. Segments may be whole words or single characters depending on how the
 * diff paired things up, so position is the only stable way to ask "what owns
 * this bit of text".
 */
function idAt(segments: Segment[], needle: string): string | undefined {
  const text = segments
    .map((s) => s.string)
    .join("")
    .replace(/\u00A0/g, " ");
  const target = text.indexOf(needle);
  if (target < 0) return undefined;

  let offset = 0;
  for (const seg of segments) {
    const end = offset + seg.string.length;
    if (offset <= target && target < end) return seg.id;
    offset = end;
  }
  return undefined;
}

describe("diffSegments", () => {
  describe("exact word matches", () => {
    it("persists matching words with same IDs", () => {
      const old = segmentText("Transaction Safe", "en");
      const { segments, splits } = diffSegments(old, "Transaction Safe", "en");

      expect(splits.size).toBe(0);
      // "Transaction" should keep the same ID
      const txn = segments.find((s) => s.string === "Transaction");
      const oldTxn = old.find((s) => s.string === "Transaction");
      expect(txn?.id).toBe(oldTxn?.id);
    });

    it("handles word reordering — Transaction Safe → Processing Transaction", () => {
      const old = segmentText("Transaction Safe", "en");
      const { segments, splits } = diffSegments(
        old,
        "Processing Transaction",
        "en",
      );

      expect(splits.size).toBe(0);

      // "Transaction" persists with the same ID
      const oldTxnId = old.find((s) => s.string === "Transaction")!.id;
      const newTxn = segments.find((s) => s.string === "Transaction");
      expect(newTxn?.id).toBe(oldTxnId);

      // "Processing" is a new word (different ID from "Safe")
      const processing = segments.find((s) => s.string === "Processing");
      expect(processing?.id).toBe("Processing");

      // "Safe" is NOT in new segments
      expect(segments.find((s) => s.string === "Safe")).toBeUndefined();
    });

    it("handles reverse — Processing Transaction → Transaction Safe", () => {
      const old = segmentText("Processing Transaction", "en");
      const { segments, splits } = diffSegments(old, "Transaction Safe", "en");

      expect(splits.size).toBe(0);

      const oldTxnId = old.find((s) => s.string === "Transaction")!.id;
      const newTxn = segments.find((s) => s.string === "Transaction");
      expect(newTxn?.id).toBe(oldTxnId);

      expect(segments.find((s) => s.string === "Safe")).toBeDefined();
      expect(segments.find((s) => s.string === "Processing")).toBeUndefined();
    });
  });

  describe("multi-cycle stability", () => {
    it("Transaction Safe ↔ Processing Transaction — 4 cycles", () => {
      let prev = segmentText("Processing Transaction", "en");
      const txnId = prev.find((s) => s.string === "Transaction")!.id;

      // Cycle 1: → Transaction Safe
      let result = diffSegments(prev, "Transaction Safe", "en");
      expect(result.segments.find((s) => s.string === "Transaction")?.id).toBe(
        txnId,
      );
      prev = result.segments;

      // Cycle 2: → Processing Transaction
      result = diffSegments(prev, "Processing Transaction", "en");
      expect(result.segments.find((s) => s.string === "Transaction")?.id).toBe(
        txnId,
      );
      prev = result.segments;

      // Cycle 3: → Transaction Safe (again)
      result = diffSegments(prev, "Transaction Safe", "en");
      expect(result.segments.find((s) => s.string === "Transaction")?.id).toBe(
        txnId,
      );
      prev = result.segments;

      // Cycle 4: → Processing Transaction (again)
      result = diffSegments(prev, "Processing Transaction", "en");
      expect(result.segments.find((s) => s.string === "Transaction")?.id).toBe(
        txnId,
      );
    });

    it("IDs are consistent across repeated cycles", () => {
      const prev = segmentText("Processing Transaction", "en");

      const cycle1 = diffSegments(prev, "Transaction Safe", "en");
      const cycle2 = diffSegments(
        cycle1.segments,
        "Processing Transaction",
        "en",
      );
      const cycle3 = diffSegments(cycle2.segments, "Transaction Safe", "en");
      const cycle4 = diffSegments(
        cycle3.segments,
        "Processing Transaction",
        "en",
      );

      // Cycle 1 and 3 should produce identical segment IDs
      expect(ids(cycle1.segments)).toEqual(ids(cycle3.segments));
      // Cycle 2 and 4 should produce identical segment IDs
      expect(ids(cycle2.segments)).toEqual(ids(cycle4.segments));
    });

    it("space IDs do not persist between different texts", () => {
      const old = segmentText("Transaction Safe", "en");
      const { segments } = diffSegments(old, "Processing Transaction", "en");

      const oldSpaceIds = old
        .filter((s) => s.string === "\u00A0")
        .map((s) => s.id);
      const newSpaceIds = segments
        .filter((s) => s.string === "\u00A0")
        .map((s) => s.id);

      // Space IDs should differ because the words have different lengths,
      // so character offsets differ. This ensures exiting words anchor to
      // word segments, not spaces.
      for (const newId of newSpaceIds) {
        expect(oldSpaceIds).not.toContain(newId);
      }
    });
  });

  describe("character morphing", () => {
    it("npm → pnpm — splits word into chars and morphs", () => {
      const old = segmentText("npm i torph", "en");
      const { segments, splits } = diffSegments(old, "pnpm add torph", "en");

      // "npm" should be split into character spans
      expect(splits.has("npm")).toBe(true);
      const charSegs = splits.get("npm")!;
      expect(charSegs).toHaveLength(3);
      expect(strings(charSegs)).toEqual(["n", "p", "m"]);

      // New segments should have char-level entries for pnpm
      // "p" is new, "n", "p", "m" persist from npm
      const pnpmChars = segments.filter(
        (s) => s.string !== "\u00A0" && s.string.length === 1,
      );
      expect(strings(pnpmChars)).toEqual(["p", "n", "p", "m"]);

      // The persisting chars should have IDs matching the split
      const nSeg = pnpmChars.find(
        (s) => s.string === "n" && s.id === charSegs[0]!.id,
      );
      expect(nSeg).toBeDefined();

      // "torph" persists as a word
      const torph = segments.find((s) => s.string === "torph");
      expect(torph?.id).toBe("torph");

      // "add" enters as a new word (no morph with "i")
      const add = segments.find((s) => s.string === "add");
      expect(add).toBeDefined();
    });

    it("pnpm → npm — reverse morph", () => {
      const old = segmentText("pnpm i torph", "en");
      const { segments, splits } = diffSegments(old, "npm i torph", "en");

      // "pnpm" should be split
      expect(splits.has("pnpm")).toBe(true);

      // n, p, m should persist from "pnpm" to "npm"
      // Filter to chars that reference the old "pnpm" word (exclude "i" which is a whole word)
      const morphedChars = segments.filter(
        (s) => s.string.length === 1 && s.id.startsWith("pnpm:"),
      );
      expect(strings(morphedChars)).toEqual(["n", "p", "m"]);

      // "i" should persist as a whole word
      expect(
        segments.find((s) => s.string === "i" && s.id === "i"),
      ).toBeDefined();
    });

    it("does NOT morph dissimilar words", () => {
      const old = segmentText("cat and dog", "en");
      const { segments, splits } = diffSegments(old, "fish and bird", "en");

      // No splits — words are too different
      expect(splits.size).toBe(0);

      // "and" persists
      expect(segments.find((s) => s.string === "and")?.id).toBe("and");
      // "fish" and "bird" are whole words
      expect(segments.find((s) => s.string === "fish")).toBeDefined();
      expect(segments.find((s) => s.string === "bird")).toBeDefined();
    });

    it("multi-cycle morph: npm → pnpm → npm", () => {
      const initial = segmentText("npm i torph", "en");

      // npm → pnpm
      const r1 = diffSegments(initial, "pnpm i torph", "en");
      expect(r1.splits.has("npm")).toBe(true);

      // pnpm → npm (reverse)
      const r2 = diffSegments(r1.segments, "npm i torph", "en");

      // The char-level segments from r1 should produce char-level output for npm
      // n, p, m persist from old "pnpm" chars
      const morphedChars = r2.segments.filter(
        (s) => s.string.length === 1 && s.string !== "\u00A0" && s.id !== "i",
      );
      expect(strings(morphedChars)).toEqual(["n", "p", "m"]);

      // "i" and "torph" should persist as whole words
      expect(r2.segments.find((s) => s.string === "i")).toBeDefined();
      expect(r2.segments.find((s) => s.string === "torph")).toBeDefined();
    });
  });

  describe("granularity transitions", () => {
    it("persists chars when going from single word to multi word", () => {
      const old = segmentText("hello", "en");
      const { segments, splits } = diffSegments(old, "hello world", "en");

      expect(splits.size).toBe(0);
      // Old char segments should persist (grapheme IDs reused)
      const oldCharIds = old.map((s) => s.id);
      const newCharIds = segments
        .filter((s) => s.string !== "\u00A0")
        .filter((s) => s.string.length === 1)
        .map((s) => s.id);
      // All old char IDs should appear in new segments
      for (const id of oldCharIds) {
        expect(newCharIds).toContain(id);
      }
      // "world" should enter as a new word
      expect(segments.find((s) => s.string === "world")).toBeDefined();
    });

    it("persists word when going from multi word to single word", () => {
      const old = segmentText("hello world", "en");
      const { segments } = diffSegments(old, "hello", "en");

      // "hello" should persist with same ID
      const oldHello = old.find((s) => s.string === "hello")!;
      const newHello = segments.find((s) => s.string === "hello");
      expect(newHello?.id).toBe(oldHello.id);
      // "world" should not be present
      expect(segments.find((s) => s.string === "world")).toBeUndefined();
    });

    it("uses segmentText when both old and new are single words", () => {
      const old = segmentText("hello", "en");
      const { segments, splits } = diffSegments(old, "world", "en");

      expect(splits.size).toBe(0);
      expect(segments.length).toBeGreaterThan(0);
    });

    it("uses segmentText when old segments are empty", () => {
      const { segments, splits } = diffSegments([], "hello world", "en");

      expect(splits.size).toBe(0);
      expect(segments.length).toBeGreaterThan(0);
    });
  });

  describe("word reordering beyond LCS", () => {
    it("persists both words when swapped — hello world → world hello", () => {
      const old = segmentText("hello world", "en");
      const { segments, splits } = diffSegments(old, "world hello", "en");

      expect(splits.size).toBe(0);

      const oldHello = old.find((s) => s.string === "hello")!;
      const oldWorld = old.find((s) => s.string === "world")!;
      const newHello = segments.find((s) => s.string === "hello");
      const newWorld = segments.find((s) => s.string === "world");

      expect(newHello?.id).toBe(oldHello.id);
      expect(newWorld?.id).toBe(oldWorld.id);
    });
  });

  describe("repeated words match the nearest occurrence", () => {
    it("keeps a repeated word's identity on the first occurrence", () => {
      const old = segmentText("hello world", "en");
      const { segments } = diffSegments(old, "hello there hello", "en");

      const oldHello = old.find((s) => s.string === "hello")!;
      const hellos = segments.filter((s) => s.string === "hello");

      expect(hellos).toHaveLength(2);
      // The leading "hello" is the one that was already on screen; the trailing
      // one is new. Matching the trailing one instead makes the text visibly
      // fly across the block.
      expect(hellos[0]?.id).toBe(oldHello.id);
      expect(hellos[1]?.id).not.toBe(oldHello.id);
    });

    it("matches the import line to the import line, not to a later usage", () => {
      const old = segmentText(
        "import { TextMorph } from 'torph'\n\nconst m = new TextMorph({});",
        "en",
      );
      const { segments } = diffSegments(
        old,
        "import { TextMorph } from 'torph/vue'\n\n<script setup>\n  import { TextMorph } from 'torph/vue';\n</script>",
        "en",
      );

      // The old import line owns the bare "TextMorph" ID — "new TextMorph({});"
      // is one word, so its "TextMorph" is qualified by position.
      const oldImportTextMorph = old.find((s) => s.string === "TextMorph")!;
      expect(oldImportTextMorph.id).toBe("TextMorph");

      // Assert by document position, not by segment: when the diff picks the
      // wrong occurrence the leading "TextMorph" is char-morphed, so there is
      // no whole "TextMorph" segment there to look for.
      expect(idAt(segments, "TextMorph")).toBe(oldImportTextMorph.id);
    });
  });

  describe("separators at the edges of the value", () => {
    /**
     * The initial render segments the whole value with `segmentText`, every
     * later render diffs against the previous segments. If the two disagree
     * about leading or trailing whitespace the text visibly shifts on the
     * first morph — a dropped trailing newline collapses a blank line and the
     * container jumps a line height.
     */
    function rendered(segments: Segment[]): string {
      return strings(segments)
        .join("")
        .replace(/\u00A0/g, " ");
    }

    const cases = [
      ["leading newline", "\nHello world"],
      ["leading space", " Hello world"],
      ["trailing newline", "Hello world\n"],
      ["trailing space", "Hello world "],
      ["leading blank line", "\n\nHello world"],
      ["trailing blank line", "Hello world\n\n"],
      ["both edges", "\n  Hello world  \n"],
      ["whitespace only", "   "],
    ] as const;

    for (const [label, value] of cases) {
      it(`preserves ${label} — matches the initial render`, () => {
        const old = segmentText("Hello world", "en");
        const { segments } = diffSegments(old, value, "en");

        expect(rendered(segments)).toBe(rendered(segmentText(value, "en")));
      });

      it(`allocates unique IDs for ${label}`, () => {
        const old = segmentText("Hello world", "en");
        const { segments } = diffSegments(old, value, "en");

        expect(new Set(ids(segments)).size).toBe(segments.length);
      });
    }

    it("keeps a trailing newline stable across repeated morphs", () => {
      let current = segmentText("a\nb\n", "en");
      for (const next of ["a\nc\n", "a\nd\n", "a\nb\n"]) {
        current = diffSegments(current, next, "en").segments;
        expect(rendered(current)).toBe(next);
      }
    });
  });

  describe("large values", () => {
    const words = (n: number, salt: string) =>
      Array.from({ length: n }, (_, i) => `${salt}${i}word`).join(" ");

    it("still produces the right text once morph pairing is skipped", () => {
      const old = segmentText(words(200, "a"), "en");
      const next = words(200, "b");
      const { segments } = diffSegments(old, next, "en");

      expect(
        strings(segments)
          .join("")
          .replace(/\u00A0/g, " "),
      ).toBe(next);
      expect(new Set(ids(segments)).size).toBe(segments.length);
    });

    it("still produces the right text once the diff bails entirely", () => {
      const old = segmentText(words(600, "a"), "en");
      const next = words(600, "b");
      const { segments } = diffSegments(old, next, "en");

      expect(
        strings(segments)
          .join("")
          .replace(/\u00A0/g, " "),
      ).toBe(next);
      expect(new Set(ids(segments)).size).toBe(segments.length);
    });

    it("keeps word matching for large values that mostly persist", () => {
      const base = words(200, "a");
      const old = segmentText(base, "en");
      const { segments } = diffSegments(old, `${base} extra`, "en");

      // Under the pairing budget nothing is unmatched, so every original word
      // keeps its element and only "extra" enters.
      const oldFirst = old.find((s) => s.string === "a0word")!;
      expect(idAt(segments, "a0word")).toBe(oldFirst.id);
    });
  });
});
