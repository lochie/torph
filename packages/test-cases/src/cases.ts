import type { Segment, TestCase } from "./types";
import {
  combineResults,
  renderSegments,
  verifyCharMorph,
  verifyCycleStability,
  verifyGraphemeMorph,
  verifyNoMorph,
  verifyWordAbsent,
  verifyWordPersistence,
} from "./verify";

const L = "en";

// Run by both the vitest suite in `packages/torph` and the playground at
// `/playground`. Adding a case here adds it to both.
export const CASES: TestCase[] = [
  // ── Basics: word persistence, enter, exit, reorder ──
  {
    label: "Word reorder + exit",
    description:
      "Transaction should FLIP to its new position. Safe should exit, Processing should enter.",
    tags: ["flip", "exit direction"],
    values: ["Transaction Safe", "Processing Transaction"],
    verify: (t) =>
      verifyWordPersistence(
        t,
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      ),
  },
  {
    label: "Same word, reversed order",
    description:
      'Both "hello" and "world" FLIP to swap positions. No enter/exit — just movement.',
    tags: ["flip"],
    values: ["hello world", "world hello"],
    verify: (t) =>
      combineResults(
        verifyWordPersistence(t, "hello world", "world hello", "hello"),
        verifyWordPersistence(t, "hello world", "world hello", "world"),
      ),
  },
  {
    label: "Add word",
    description: '"hello" persists in place. "world" enters with fade + scale.',
    tags: ["enter"],
    values: ["hello", "hello world"],
    verify: (t) => {
      const old = t.segmentText("hello", L);
      const { segments } = t.diffSegments(old, "hello world", L);
      const newIds = new Set(segments.map((s: Segment) => s.id));
      const lost = old.filter((s: Segment) => !newIds.has(s.id));
      const worldEnters = segments.some((s: Segment) => s.string === "world");

      return {
        pass: lost.length === 0 && worldEnters,
        detail: lost.length
          ? `Lost IDs: ${lost.map((s: Segment) => s.id).join(", ")}`
          : worldEnters
            ? "hello chars persist; world enters"
            : "world missing",
      };
    },
  },
  {
    label: "Remove word",
    description: '"hello" persists. "world" exits with fade out.',
    tags: ["exit"],
    values: ["hello world", "hello"],
    verify: (t) =>
      combineResults(
        verifyWordPersistence(t, "hello world", "hello", "hello"),
        verifyWordAbsent(t, "hello world", "hello", "world"),
      ),
  },
  {
    label: "Dissimilar word replacement",
    description:
      '"cat" and "dog" exit as whole words (no char morph). "fish" and "bird" enter. "and" persists.',
    tags: ["no morph", "enter", "exit"],
    values: ["cat and dog", "fish and bird"],
    verify: (t) =>
      combineResults(
        verifyNoMorph(t, "cat and dog", "fish and bird"),
        verifyWordPersistence(t, "cat and dog", "fish and bird", "and"),
      ),
  },
  {
    label: "Multi-word persist",
    description:
      '"the" and "brown" persist across states. Changed words enter/exit smoothly.',
    tags: ["flip", "enter", "exit"],
    values: [
      "the quick brown fox",
      "the slow brown dog",
      "a quick brown fox jumps",
    ],
    verify: (t) =>
      combineResults(
        verifyWordPersistence(
          t,
          "the quick brown fox",
          "the slow brown dog",
          "brown",
        ),
        verifyWordPersistence(
          t,
          "the quick brown fox",
          "the slow brown dog",
          "the",
        ),
      ),
  },
  {
    label: "Duplicate words",
    description:
      'Both "the" instances persist with distinct IDs. "cat"/"dog" exit, "big"/"small" enter.',
    tags: ["duplicates", "flip"],
    values: ["the cat and the dog", "the big and the small"],
    verify: (t) => {
      const old = t.segmentText("the cat and the dog", L);
      const { segments } = t.diffSegments(old, "the big and the small", L);
      const oldThes = old.filter((s: Segment) => s.string === "the");
      const newThes = segments.filter((s: Segment) => s.string === "the");

      const bothPersist =
        oldThes.length === 2 &&
        newThes.length === 2 &&
        oldThes[0]!.id === newThes[0]!.id &&
        oldThes[1]!.id === newThes[1]!.id;
      const distinct =
        newThes.length === 2 && newThes[0]!.id !== newThes[1]!.id;
      const andPersists =
        old.find((s: Segment) => s.string === "and")?.id ===
        segments.find((s: Segment) => s.string === "and")?.id;

      return {
        pass: bothPersist && distinct && andPersists,
        detail: !bothPersist
          ? 'Duplicate "the" IDs not preserved'
          : !distinct
            ? 'Both "the" segments share one ID'
            : andPersists
              ? 'Both "the" IDs persist and stay distinct; "and" persists'
              : '"and" ID changed',
      };
    },
  },

  // ── Character morph ──
  {
    label: "Character morph (add prefix)",
    description:
      '"p" enters while "n", "p", "m" persist and FLIP. "i" and "torph" stay unchanged.',
    tags: ["char morph", "split"],
    values: ["npm i torph", "pnpm i torph"],
    verify: (t) => verifyCharMorph(t, "npm i torph", "pnpm i torph", "npm"),
  },
  {
    label: "Character morph + word swap",
    description:
      '"npm" morphs to "pnpm" at char level. "i" exits, "add" enters. "torph" persists.',
    tags: ["char morph", "enter", "exit"],
    values: ["npm i torph", "pnpm add torph"],
    verify: (t) =>
      combineResults(
        verifyCharMorph(t, "npm i torph", "pnpm add torph", "npm"),
        verifyWordPersistence(t, "npm i torph", "pnpm add torph", "torph"),
      ),
  },
  {
    label: "Reverse character morph",
    description:
      '"pnpm" splits into chars. "n", "p", "m" persist into "npm", the leading "p" exits.',
    tags: ["char morph", "reverse"],
    values: ["pnpm i torph", "npm i torph"],
    verify: (t) => verifyCharMorph(t, "pnpm i torph", "npm i torph", "pnpm"),
  },
  {
    label: "Single character change",
    description: '"c", "a", "r" persist. "t" exits and "d" enters.',
    tags: ["char morph"],
    values: ["cart", "card"],
    verify: (t) => verifyGraphemeMorph(t, "cart", "card", ["c", "a", "r"]),
  },
  {
    label: "Case change",
    description:
      "Same words, different casing. Char morph handles the letter-level changes.",
    tags: ["char morph"],
    values: ["Hello World", "hello world"],
    verify: (t) => verifyCharMorph(t, "Hello World", "hello world", "Hello"),
  },
  {
    label: "Punctuation",
    description:
      '"Hello," char-morphs to "Hello" — shared char IDs persist. "world!" likewise morphs to "world".',
    tags: ["char morph"],
    values: ["Hello, world!", "Hello world"],
    verify: (t) => {
      const old = t.segmentText("Hello, world!", L);
      const { segments } = t.diffSegments(old, "Hello world", L);
      const oldIds = new Set(old.map((s: Segment) => s.id));
      const persisted = segments.filter((s: Segment) => oldIds.has(s.id));
      const pass = persisted.length >= 4;

      return {
        pass,
        detail: pass
          ? `${persisted.length} char IDs persist across punctuation change`
          : `Only ${persisted.length} IDs persisted (expected ≥4)`,
      };
    },
  },
  {
    label: "Numbers",
    description:
      "Shared digits and symbols ($, commas) persist. New digits enter.",
    tags: ["char morph"],
    values: ["$1,234", "$12,345,678", "$99"],
    align: "right",
    verify: (t) =>
      verifyGraphemeMorph(t, "$1,234", "$12,345,678", ["$", "1", ","]),
  },
  {
    label: "Long word char morph",
    description:
      "Character-level morph on a long single word with partial overlap.",
    tags: ["char morph", "stress"],
    values: ["abcdefghijklmnop", "abcmnopqrstuvwx"],
    verify: (t) =>
      verifyGraphemeMorph(t, "abcdefghijklmnop", "abcmnopqrstuvwx", [
        "a",
        "b",
        "c",
        "m",
        "n",
        "o",
        "p",
      ]),
  },

  // ── Multiline ──
  {
    label: "Multiline basic",
    description:
      "Shared words persist across line breaks. Newlines are treated as word boundaries.",
    tags: ["multiline"],
    values: ["hello\nworld", "hello\nuniverse"],
    minLines: 2,
    verify: (t) =>
      verifyWordPersistence(t, "hello\nworld", "hello\nuniverse", "hello"),
  },
  {
    label: "Multiline add line",
    description: "Adding a new line enters new words. Existing words persist.",
    tags: ["multiline", "enter"],
    values: ["hello world\ngoodbye", "hello world\ngoodbye\nfarewell"],
    minLines: 2,
    verify: (t) =>
      combineResults(
        verifyWordPersistence(
          t,
          "hello world\ngoodbye",
          "hello world\ngoodbye\nfarewell",
          "hello",
        ),
        verifyWordPersistence(
          t,
          "hello world\ngoodbye",
          "hello world\ngoodbye\nfarewell",
          "goodbye",
        ),
      ),
  },
  {
    label: "Multiline remove line",
    description: "Removing a line exits those words. Remaining words persist.",
    tags: ["multiline", "exit"],
    values: ["hello world\nfoo bar\ngoodbye moon", "hello world\ngoodbye moon"],
    minLines: 2,
    verify: (t) =>
      combineResults(
        verifyWordPersistence(
          t,
          "hello world\nfoo bar\ngoodbye moon",
          "hello world\ngoodbye moon",
          "hello",
        ),
        verifyWordPersistence(
          t,
          "hello world\nfoo bar\ngoodbye moon",
          "hello world\ngoodbye moon",
          "goodbye",
        ),
        verifyWordAbsent(
          t,
          "hello world\nfoo bar\ngoodbye moon",
          "hello world\ngoodbye moon",
          "foo",
        ),
      ),
  },
  {
    label: "Multiline reorder",
    description:
      "Swapping line order. Shared words persist and FLIP to new positions.",
    tags: ["multiline", "flip"],
    values: ["alpha bravo\ncharlie delta", "charlie delta\nalpha bravo"],
    minLines: 2,
    verify: (t) =>
      combineResults(
        verifyWordPersistence(
          t,
          "alpha bravo\ncharlie delta",
          "charlie delta\nalpha bravo",
          "alpha",
        ),
        verifyWordPersistence(
          t,
          "alpha bravo\ncharlie delta",
          "charlie delta\nalpha bravo",
          "charlie",
        ),
      ),
  },
  {
    label: "Multiline with edits",
    description:
      "Lines change content while shared words persist across the multiline transition.",
    tags: ["multiline", "flip"],
    values: [
      "the quick brown fox\njumps over the lazy dog",
      "the slow red fox\nleaps over the happy cat",
    ],
    minLines: 2,
    verify: (t) => {
      const from = "the quick brown fox\njumps over the lazy dog";
      const to = "the slow red fox\nleaps over the happy cat";
      return combineResults(
        verifyWordPersistence(t, from, to, "the"),
        verifyWordPersistence(t, from, to, "fox"),
        verifyWordPersistence(t, from, to, "over"),
      );
    },
  },
  {
    label: "Multiline ↔ single line",
    description:
      "Toggling between line break and space. Words persist and FLIP between vertical/horizontal layout.",
    tags: ["multiline", "flip"],
    values: ["hello\nworld", "hello world"],
    verify: (t) =>
      combineResults(
        verifyWordPersistence(t, "hello\nworld", "hello world", "hello"),
        verifyWordPersistence(t, "hello\nworld", "hello world", "world"),
        verifyWordPersistence(t, "hello world", "hello\nworld", "hello"),
        verifyWordPersistence(t, "hello world", "hello\nworld", "world"),
      ),
  },
  {
    label: "Empty lines",
    description: "Collapsing a blank line. Words on remaining lines persist.",
    tags: ["multiline", "edge case"],
    values: ["hello\n\nworld", "hello\nworld"],
    verify: (t) =>
      combineResults(
        verifyWordPersistence(t, "hello\n\nworld", "hello\nworld", "hello"),
        verifyWordPersistence(t, "hello\n\nworld", "hello\nworld", "world"),
      ),
  },
  {
    label: "Multiline empty transition",
    description:
      "Multiline text exits to empty, then new multiline content enters from empty.",
    tags: ["multiline", "edge case"],
    values: ["hello\nworld", "", "foo\nbar"],
    verify: (t) => {
      const out = t.diffSegments(t.segmentText("hello\nworld", L), "", L);
      const back = t.diffSegments([], "foo\nbar", L);
      const breaks = back.segments.filter((s: Segment) => s.string === "\n");
      const pass =
        out.segments.length === 0 &&
        back.segments.some((s: Segment) => s.string === "foo") &&
        back.segments.some((s: Segment) => s.string === "bar") &&
        breaks.length === 1;

      return {
        pass,
        detail: pass
          ? "Multiline → empty → multiline works, line break preserved"
          : `exit segs=${out.segments.length}, re-entered=${renderSegments(back.segments)}`,
      };
    },
  },

  // ── Edge cases ──
  {
    label: "Empty to text",
    description:
      '"hello world" enters from empty. Morphing back to "" fades all words out gracefully.',
    tags: ["edge case"],
    values: ["", "hello world", ""],
    verify: (t) => {
      const { segments } = t.diffSegments([], "hello world", L);
      const back = t.diffSegments(t.segmentText("hello world", L), "", L);
      const pass =
        segments.some((s: Segment) => s.string === "hello") &&
        back.segments.length === 0;

      return {
        pass,
        detail: pass
          ? "Empty → text produces segments; text → empty produces none"
          : `segments=${segments.length}, reverse=${back.segments.length}`,
      };
    },
  },
  {
    label: "Single character",
    description:
      "Minimal content — single char replacement. Each transition is a full exit/enter.",
    tags: ["edge case"],
    values: ["a", "b", "c"],
    verify: (t) => verifyWordAbsent(t, "a", "b", "a"),
  },
  {
    label: "Complete replacement",
    description:
      "No character overlap. Everything exits and enters — no morph or persistence.",
    tags: ["edge case", "enter", "exit"],
    values: ["abcdef", "xyz"],
    verify: (t) => {
      const old = t.segmentText("abcdef", L);
      const { segments, splits } = t.diffSegments(old, "xyz", L);
      const rendered = renderSegments(segments);
      const oldIds = new Set(old.map((s: Segment) => s.id));
      const carried = segments.filter((s: Segment) => oldIds.has(s.id));

      // Absences alone would hold for a diff that returned nothing at all.
      return combineResults(
        {
          pass: rendered === "xyz",
          detail:
            rendered === "xyz"
              ? 'Renders "xyz"'
              : `Rendered ${JSON.stringify(rendered)}`,
        },
        {
          pass: splits.size === 0,
          detail:
            splits.size === 0
              ? "No char splits (correct)"
              : `Unexpected splits: ${[...splits.keys()].join(", ")}`,
        },
        {
          pass: carried.length === 0,
          detail: carried.length
            ? `${carried.length} IDs unexpectedly persisted`
            : "Nothing persists across a full replacement",
        },
      );
    },
  },
  {
    label: "Whitespace normalization",
    description:
      "Extra spaces should not cause unexpected segment splits or ID changes.",
    tags: ["edge case"],
    values: ["hello world", "hello  world", "hello world"],
    verify: (t) => {
      const { segments } = t.diffSegments(
        t.segmentText("hello world", L),
        "hello  world",
        L,
      );
      const rendered = renderSegments(segments);

      return combineResults(
        {
          pass: rendered === "hello  world",
          detail:
            rendered === "hello  world"
              ? "Double space survives the morph"
              : `Rendered ${JSON.stringify(rendered)}`,
        },
        verifyWordPersistence(t, "hello world", "hello  world", "hello"),
        verifyWordPersistence(t, "hello world", "hello  world", "world"),
      );
    },
  },

  // ── Unicode & i18n ──
  {
    label: "Emoji",
    description:
      "Emoji grapheme clusters are treated as single segments and persist correctly.",
    tags: ["grapheme"],
    values: ["Hello 👋", "Goodbye 👋"],
    verify: (t) => verifyWordPersistence(t, "Hello 👋", "Goodbye 👋", "👋"),
  },
  {
    label: "Compound emoji",
    description:
      "Complex emoji (family, flag sequences) are treated as single grapheme segments.",
    tags: ["grapheme"],
    values: ["Hello 👨‍👩‍👧‍👦", "Goodbye 👨‍👩‍👧‍👦"],
    verify: (t) => verifyWordPersistence(t, "Hello 👨‍👩‍👧‍👦", "Goodbye 👨‍👩‍👧‍👦", "👨‍👩‍👧‍👦"),
  },
  {
    label: "Unicode accents",
    description:
      "Accented characters (café → cafe). Shared base chars persist.",
    tags: ["grapheme"],
    values: ["café", "cafe"],
    verify: (t) => verifyGraphemeMorph(t, "café", "cafe", ["c", "a", "f"]),
  },
  {
    label: "RTL text (Arabic)",
    description:
      "Arabic text segments and diffs correctly. Shared words persist.",
    tags: ["i18n"],
    values: ["مرحبا بالعالم", "مرحبا يا صديقي"],
    verify: (t) =>
      verifyWordPersistence(t, "مرحبا بالعالم", "مرحبا يا صديقي", "مرحبا"),
  },
  {
    label: "RTL text (Hebrew)",
    description: "Hebrew text segmentation and persistence of shared words.",
    tags: ["i18n"],
    values: ["שלום עולם", "שלום חברים"],
    verify: (t) => verifyWordPersistence(t, "שלום עולם", "שלום חברים", "שלום"),
  },

  // ── Stress & stability ──
  {
    label: "Long sentence overlap",
    description: '"quick", "fox", "over" persist. Other words swap in/out.',
    tags: ["stress", "flip"],
    values: [
      "the quick brown fox jumps over the lazy dog",
      "the quick red fox leaps over the happy cat",
    ],
    verify: (t) => {
      const from = "the quick brown fox jumps over the lazy dog";
      const to = "the quick red fox leaps over the happy cat";
      return combineResults(
        verifyWordPersistence(t, from, to, "quick"),
        verifyWordPersistence(t, from, to, "fox"),
        verifyWordPersistence(t, from, to, "over"),
      );
    },
  },
  {
    label: "Long paragraph",
    description:
      "Stress test with paragraph-length text. Common words persist, unique words enter/exit.",
    tags: ["stress", "flip"],
    values: [
      "The quick brown fox jumps over the lazy dog while the sun sets behind the distant mountains",
      "The slow gray wolf runs under the bright moon while the rain falls across the nearby valleys",
    ],
    verify: (t) => {
      const from =
        "The quick brown fox jumps over the lazy dog while the sun sets behind the distant mountains";
      const to =
        "The slow gray wolf runs under the bright moon while the rain falls across the nearby valleys";
      return combineResults(
        verifyWordPersistence(t, from, to, "while"),
        verifyWordPersistence(t, from, to, "the"),
      );
    },
  },
  {
    label: "Multi-cycle stability",
    description:
      '"Transaction" ID stays the same across 4+ cycles. Exit direction should never flip.',
    tags: ["stability", "cycles"],
    values: ["Transaction Safe", "Processing Transaction"],
    verify: (t) =>
      verifyCycleStability(
        t,
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      ),
  },
  {
    label: "Rapid spam (auto-cycle)",
    description:
      "Hit Auto to toggle every 150ms. Animations should queue gracefully without glitches.",
    tags: ["spam", "resilience"],
    values: ["Transaction Safe", "Processing Transaction"],
    verify: (t) =>
      verifyCycleStability(
        t,
        "Transaction Safe",
        "Processing Transaction",
        "Transaction",
      ),
  },
];

export const ALL_TAGS = [...new Set(CASES.flatMap((c) => c.tags))].sort();
