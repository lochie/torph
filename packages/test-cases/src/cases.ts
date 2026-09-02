import type { Segment, TestCase } from "./types";
import {
  combineResults,
  renderSegments,
  verifyCharMorph,
  verifyCycleStability,
  verifyGraphemeMorph,
  verifyKinds,
  verifyKindsAfterMorph,
  verifyNoMorph,
  verifyTextPlaces,
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
    label: "Numbers morph by place",
    description:
      "A numeric word goes to the number matcher, not to character matching. Four orders of magnitude is past the point where the two are the same figure moving, so only the affix holds and the number itself is replaced.",
    tags: ["number", "place"],
    values: ["$1,234", "$12,345,678", "$99"],
    align: "right",
    verify: (t) =>
      verifyTextPlaces(t, "$1,234", "$12,345,678", [
        [0, 0],
        [1, null],
        [7, null],
      ]),
  },
  {
    label: "Number inside a sentence",
    description:
      "The figure morphs by place while the words around it hold their identity — the units digit stays put as the count grows a tens column.",
    tags: ["number", "place"],
    values: ["3 unread messages", "13 unread messages", "9 unread messages"],
    verify: (t) =>
      verifyTextPlaces(t, "3 unread messages", "13 unread messages", [
        [0, null],
        [1, 0],
        [3, 2],
        [5, 4],
      ]),
  },
  {
    label: "Digits and symbols are told apart",
    description:
      "Kinds drive the animation: digits slide down into place, the symbols around them slide up. Everything else stays text.",
    tags: ["number"],
    values: ["$1,234", "$5,678"],
    verify: (t) =>
      verifyKinds(t, "$1,234", [
        "symbol",
        "digit",
        "symbol",
        "digit",
        "digit",
        "digit",
      ]),
  },
  {
    label: "Version strings stay text",
    description:
      'A token has to be a quantity all the way through to morph as one. "v1.2.3" has no units column, so it morphs character by character like any other word.',
    tags: ["number"],
    values: ["v1.2.3", "v1.3.0", "v2.0.0"],
    verify: (t) => verifyKinds(t, "v1.2.3", new Array(6).fill(undefined)),
  },
  {
    label: "Two numbers, one sentence",
    description:
      "The second figure pairs with the second figure, not with the first. Both numbers stand in for each other during the word-level match, so their order in the sentence is what carries them across.",
    tags: ["number", "place"],
    values: ["2 of 10 done", "2 of 15 done", "7 of 15 done"],
    verify: (t) =>
      verifyTextPlaces(t, "2 of 10 done", "2 of 15 done", [
        [0, 0],
        [4, 4],
        [5, null],
        [7, 7],
      ]),
  },
  {
    label: "Emptying a number to its affix",
    description:
      'Backspacing the last digit out of "$4" leaves a token with no digits left to be a number by. The dollar sign is still the same dollar sign, so it holds rather than re-entering.',
    tags: ["number", "exit"],
    values: ["$4", "$", "$4", "$420"],
    verify: (t) =>
      combineResults(
        verifyTextPlaces(t, "$4", "$", [[0, 0]]),
        verifyTextPlaces(t, "$", "$420", [[0, 0]]),
      ),
  },
  {
    label: "A number never claims a word",
    description:
      '"5" and "five" are the same quantity and share no characters, so the digit leaves and the word arrives. Spelling is the only thing the diff can see.',
    tags: ["number"],
    values: ["5 items", "five items"],
    verify: (t) =>
      combineResults(
        verifyTextPlaces(t, "5 items", "five items", [
          [0, null],
          [2, 2],
        ]),
        verifyWordPersistence(t, "5 items", "five items", "items"),
      ),
  },
  {
    label: "Affixes hold while digits churn",
    description:
      "Brackets, currency symbols and group separators are the still part of a number. Every digit can change under them without any of them moving.",
    tags: ["number", "place"],
    values: ["(1,234)", "(5,678)", "12%", "97%"],
    align: "right",
    verify: (t) =>
      verifyTextPlaces(t, "(1,234)", "(5,678)", [
        [0, 0],
        [2, 2],
        [6, 6],
      ]),
  },
  {
    label: "A digit pushed into the middle",
    description:
      "1,234 gains a column and 123,456 gains a digit in the middle of itself. Both keep every digit they already had: when a number changes shape rather than just value, what carries is which digits are the same digits, so the run slides to its new magnitude instead of the whole figure being rebuilt around the newcomer.",
    tags: ["number", "place", "enter"],
    values: ["123,456", "1,234,576"],
    verify: (t) =>
      verifyTextPlaces(t, "123,456", "1,234,576", [
        [0, 0],
        [2, 1],
        [3, 2],
        [4, 4],
        [6, 5],
        [8, 6],
        [7, null],
      ]),
  },
  {
    label: "A number holds across a new line",
    description:
      "A second line arrives above a figure that has not itself changed. Each numeric character sits in its own clip box rather than relying on the root, so gaining a line costs the number nothing — every digit keeps its identity and its place.",
    tags: ["number", "multiline"],
    values: ["1,234", "Total\n1,234"],
    minLines: 2,
    verify: (t) =>
      combineResults(
        verifyTextPlaces(t, "1,234", "Total\n1,234", [
          [2, 0],
          [3, 1],
          [4, 2],
          [5, 3],
          [6, 4],
        ]),
        verifyKindsAfterMorph(t, "1,234", "Total\n1,234", [
          undefined,
          undefined,
          "digit",
          "symbol",
          "digit",
          "digit",
          "digit",
        ]),
      ),
  },
  {
    label: "A number changes as a line arrives",
    description:
      "The second line and a new figure land on the same morph. Place matching still applies across the line change, and every digit here is different — so the group separator is the one thing that carries.",
    tags: ["number", "multiline", "place"],
    values: ["1,234", "Total\n5,678"],
    minLines: 2,
    verify: (t) =>
      verifyTextPlaces(t, "1,234", "Total\n5,678", [
        [2, null],
        [3, 1],
      ]),
  },
  {
    label: "A number on a middle line updates",
    description:
      "The figure between two other lines is replaced while they hold still, newlines included. A digit slides one line box, not the height of the whole block, and its slot is what it disappears behind — so the lines around it are never touched.",
    tags: ["number", "multiline", "place"],
    values: ["a\n1,234\nb", "a\n5,678\nb"],
    minLines: 3,
    verify: (t) =>
      combineResults(
        verifyTextPlaces(t, "a\n1,234\nb", "a\n5,678\nb", [
          [0, 0],
          [1, 1],
          [3, 3],
          [7, 7],
          [8, 8],
        ]),
        verifyKindsAfterMorph(t, "a\n1,234\nb", "a\n5,678\nb", [
          undefined,
          undefined,
          "digit",
          "symbol",
          "digit",
          "digit",
          "digit",
          undefined,
          undefined,
        ]),
      ),
  },
  {
    label: "A number swaps lines with its label",
    description:
      "The figure moves from the bottom line to the top and the label goes the other way. Both are matched as whole words across the newline, so they trade places intact rather than being rebuilt.",
    tags: ["number", "multiline"],
    values: ["text\n1,234", "1,234\ntext"],
    minLines: 2,
    verify: (t) =>
      verifyTextPlaces(t, "text\n1,234", "1,234\ntext", [
        [0, 2],
        [1, 3],
        [4, 6],
        [6, 0],
      ]),
  },
  {
    label: "Dates stay text",
    description:
      "Same rule, and the one that matters most for a default: a hyphen is not a group separator, so a date is never mistaken for a number.",
    tags: ["number"],
    values: ["2024-01-01", "2024-02-01"],
    verify: (t) => verifyKinds(t, "2024-01-01", new Array(10).fill(undefined)),
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
