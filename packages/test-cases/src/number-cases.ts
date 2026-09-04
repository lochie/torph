import type { NumberCase } from "./types";
import { combineResults } from "./verify";
import {
  verifyAlignment,
  verifyNoLateralShift,
  verifyNumberCycleStability,
  verifyPersistedCount,
  verifyPlaces,
  verifyUniqueIds,
} from "./number-verify";

// Run by both the vitest suite in `packages/torph` and the playground at
// `/playground`. Adding a case here adds it to both.
//
// Every assertion is about *place*: which character of the new value came from
// which character of the old one. A number reads as one continuous quantity
// only if each digit keeps its significance across the morph, so that mapping
// is the whole contract.
export const NUMBER_CASES: NumberCase[] = [
  // ── Place matching: digits keep their significance ──
  {
    label: "Counter tick",
    description:
      "Only the units digit changes. The hundreds and tens digits should sit perfectly still.",
    tags: ["place", "counter"],
    values: [100, 101, 102, 103],
    verify: (t) => verifyAlignment(t, "100", "101", [0, 1, null]),
  },
  {
    label: "Integer grows left",
    description:
      "199 keeps 99 where it is and grows a new hundreds digit on the left, rather than shunting every digit along.",
    tags: ["place", "enter"],
    values: ["99", "199", "1,199"],
    verify: (t) => verifyAlignment(t, "99", "199", [null, 0, 1]),
  },
  {
    label: "Mismatched digit mid-number",
    description:
      "A changed hundreds digit says nothing about the digits either side — they hold their places while it swaps.",
    tags: ["place"],
    values: ["1,234", "1,834"],
    verify: (t) => verifyAlignment(t, "1,234", "1,834", [0, 1, null, 3, 4]),
  },
  {
    label: "Every digit changes",
    description:
      "Nothing to persist. All four digits exit downward and their replacements enter from above, in place.",
    tags: ["enter", "exit"],
    values: ["1234", "5678"],
    verify: (t) => verifyAlignment(t, "1234", "5678", [null, null, null, null]),
  },

  // ── Group separators ──
  {
    label: "Separator slides up a magnitude",
    description:
      "999,999 → 1,000,000: the comma belongs to the second group now, not the first. It should slide one group along, not snap to the front.",
    tags: ["separator", "place"],
    values: ["999,999", "1,000,000"],
    verify: (t) =>
      verifyAlignment(t, "999,999", "1,000,000", [
        null,
        null,
        null,
        null,
        null,
        3,
        null,
        null,
        null,
      ]),
  },
  {
    label: "Separator slides back down",
    description:
      "The value loses a magnitude and keeps all four of the digits it still has, so they travel down together. The comma cannot travel with them — it would have to cross the run to reach its new group, the two passing in opposite directions — so it leaves and the new boundary arrives.",
    tags: ["separator", "exit"],
    values: ["12,345", "1,234"],
    verify: (t) => verifyAlignment(t, "12,345", "1,234", [0, null, 1, 3, 4]),
  },
  {
    label: "Separator survives a round trip",
    description:
      "Crossing 10,000 in both directions. The comma must keep one identity — a new one each way means it re-enters on every tick.",
    tags: ["separator", "stability"],
    values: ["9,999", "10,000"],
    verify: (t) => verifyNumberCycleStability(t, "9,999", "10,000", 1),
  },

  // ── Affixes: currency, units, signs ──
  {
    label: "Currency to millions",
    description:
      "Four orders of magnitude apart. The $ is fixed and never moves, but the figure it denominates is not the same figure moving — hundreds and millions overlap so little that carrying anything across reads as a smear rather than as continuity. Nothing inside the number survives, so it can be replaced whole.",
    tags: ["currency", "magnitude"],
    values: ["$999.50", "$1,000,000.00"],
    verify: (t) =>
      verifyPlaces(t, "$999.50", "$1,000,000.00", [
        [0, 0],
        [10, null],
        [6, null],
      ]),
  },
  {
    label: "Trailing unit held",
    description:
      'The " MB" is not part of the number. It should stay put while the fraction changes length underneath it.',
    tags: ["unit", "place"],
    values: ["1.25 MB", "1.5 MB", "999 MB"],
    verify: (t) =>
      verifyAlignment(t, "1.25 MB", "1.5 MB", [0, 1, null, 4, 5, 6]),
  },
  {
    label: "Percent sign held",
    description:
      "0% → 50%: the % holds and the 0 slides right into the tens place as a new digit enters in front of it.",
    tags: ["unit", "place"],
    values: ["0%", "50%", "100%"],
    verify: (t) => verifyAlignment(t, "0%", "50%", [null, 0, 1]),
  },
  {
    label: "Negative sign enters",
    description:
      "The digit is unchanged, so only the minus animates in — the 5 should not flicker.",
    tags: ["enter", "place"],
    values: ["5", "-5"],
    verify: (t) => verifyAlignment(t, "5", "-5", [null, 0]),
  },

  // ── Fractions and the decimal pivot ──
  {
    label: "Fraction grows right",
    description:
      "The fraction side is walked outward from the decimal point, so 1.5 → 1.55 appends rather than shifting.",
    tags: ["decimal", "place"],
    values: ["1.5", "1.55", "1.555"],
    verify: (t) => verifyAlignment(t, "1.5", "1.55", [0, 1, 2, null]),
  },
  {
    label: "Fixed decimals",
    description:
      "Formatted to two places by the `decimals` option. Both sides of the point change, so only the point itself persists.",
    tags: ["decimal", "decimals"],
    values: [3.14159, 2.71828, 1.41421],
    decimals: 2,
    verify: (t) => verifyPlaces(t, "3.14", "2.72", [[1, 1]]),
  },
  {
    label: "Fixed-width clock",
    description:
      "09:59 → 10:00. The colon is the only character that holds; every digit around it changes.",
    tags: ["place", "unit"],
    values: ["09:59", "10:00", "10:01"],
    verify: (t) =>
      verifyAlignment(t, "09:59", "10:00", [null, null, 2, null, null]),
  },

  // ── Locale ──
  {
    label: "German separators",
    description:
      "de-DE groups with dots and pivots on the comma. The decimal pivot holds, the integer digits carry across, and the group separator gives way to a new one rather than crossing them.",
    tags: ["locale", "separator"],
    values: ["1.234,56", "12.345,67"],
    locale: "de-DE",
    verify: (t) =>
      verifyAlignment(
        t,
        "1.234,56",
        "12.345,67",
        [0, 2, null, 3, 4, null, 5, null, null],
        { decimalChar: "," },
      ),
  },
  {
    label: "Locale formatting",
    description:
      "Raw numbers formatted by TextMorph itself. Grouping follows the locale, so the same value reads differently per step.",
    tags: ["locale"],
    values: [1234567.891, 9876543.21],
    locale: "de-DE",
    decimals: 2,
    verify: (t) =>
      verifyPersistedCount(t, "1.234.567,89", "9.876.543,21", 4, {
        decimalChar: ",",
      }),
  },

  {
    label: "French narrow spaces",
    description:
      "fr-FR groups with a narrow no-break space (U+202F) rather than a glyph. It is treated as the separator it is — including giving way when the digits around it are re-shaped.",
    tags: ["locale", "separator", "space"],
    values: ["1\u202F234,56", "12\u202F345,67", "1\u202F234\u202F567,89"],
    locale: "fr-FR",
    verify: (t) =>
      verifyAlignment(
        t,
        "1\u202F234,56",
        "12\u202F345,67",
        [0, 2, null, 3, 4, null, 5, null, null],
        { decimalChar: "," },
      ),
  },

  // ── Cursor matching: text input, not a counter ──
  {
    label: "Cursor insert",
    description:
      "A caret at index 3 says the 9 was typed there. Everything after it keeps its identity instead of being re-matched by place.",
    tags: ["cursor", "enter"],
    values: ["1234", "12934"],
    cursors: [undefined, 3],
    verify: (t) =>
      verifyAlignment(t, "1234", "12934", [0, 1, null, 2, 3], { cursor: 3 }),
  },
  {
    label: "Cursor delete",
    description:
      "Backspacing the last digit of a currency field. The caret pins the rest in place — no reflow of the digits in front.",
    tags: ["cursor", "exit"],
    values: ["$4.20", "$4.2"],
    cursors: [undefined, 4],
    verify: (t) =>
      verifyAlignment(t, "$4.20", "$4.2", [0, 1, 2, 3], { cursor: 4 }),
  },
  {
    label: "Typing a currency field",
    description:
      "The full type-in from the homepage demo, driven by caret position at every step.",
    tags: ["cursor", "currency", "spam"],
    values: ["$", "$2", "$20", "$420", "$4,020", "$4.20"],
    cursors: [1, 2, 3, 2, 4, 3],
    verify: (t) =>
      verifyUniqueIds(t, ["$", "$2", "$20", "$420", "$4,020", "$4.20"]),
  },
  {
    label: "Cursor grows a separator",
    description:
      "Typing the 4 of 1,234 is one keystroke that lands as two characters, and they are not adjacent. The caret speaks for the digit only \u2014 the comma it pushed in is new, and the digits before it slide rather than mutating into it.",
    tags: ["cursor", "separator", "enter"],
    values: ["123", "1,234", "12,345"],
    cursors: [undefined, 5, 6],
    verify: (t) =>
      verifyAlignment(t, "123", "1,234", [0, null, 1, 2, null], { cursor: 5 }),
  },
  {
    label: "Cursor insert beside the same digit",
    description:
      "1,111 \u2192 11,111 is the case place matching cannot call: every digit is a 1, so only the caret says which one was typed. The comma stays the comma while the digit at the caret is the one that enters.",
    tags: ["cursor", "separator", "enter"],
    values: ["1,111", "11,111"],
    cursors: [undefined, 2],
    verify: (t) =>
      verifyAlignment(t, "1,111", "11,111", [0, null, 1, 2, 3, 4], {
        cursor: 2,
      }),
  },

  // ── Symbols and affixes that are not currency ──
  {
    label: "Currency symbol swaps",
    description:
      "Only the symbol changes. Every digit, the separator and the decimal point should be perfectly still — this is the case where any wobble is unambiguously a bug.",
    tags: ["currency", "place"],
    values: ["$99.00", "€99.00", "£99.00", "¥99.00"],
    verify: (t) => verifyNoLateralShift(t, "$99.00", "€99.00", 5),
  },
  {
    label: "Delta badge",
    description:
      "A signed percentage. The sign flips and the digits change, but the decimal point and the % hold their places on either side of them.",
    tags: ["unit", "sign"],
    values: ["+2.4%", "\u22120.8%", "+11.2%", "0.0%"],
    verify: (t) =>
      verifyAlignment(t, "+2.4%", "\u22120.8%", [null, null, 2, null, 4]),
  },
  {
    label: "Compact suffix",
    description:
      "999K → 1.2K rewrites the number and grows a decimal point, but the K is an affix and belongs where it already is.",
    tags: ["unit", "decimal"],
    values: ["999K", "1.2K", "12.4M", "1.1B"],
    verify: (t) => verifyAlignment(t, "999K", "1.2K", [null, null, null, 3]),
  },
  {
    label: "Scoreline",
    description:
      "Spaces are segments too. Only the digit that actually changed should move; the spaces and the dash between them hold.",
    tags: ["space", "place"],
    values: ["0 - 0", "1 - 0", "1 - 1", "2 - 1"],
    verify: (t) => verifyNoLateralShift(t, "0 - 0", "1 - 0", 4),
  },

  // ── Tabular figures ──
  //
  // Tabular numerals give every digit the same advance width. The payoff is a
  // number that changes without the characters around it twitching — but the
  // font only holds the columns still if the diff agrees nothing moved, so
  // these assert that no persisted character changes index.
  {
    label: "Tabular digits hold their column",
    description:
      "Same length in and out, so against tabular figures every character should sit in exactly the same place — only the glyphs swap. Any lateral movement here is the diff's fault, not the font's.",
    tags: ["tabular", "place"],
    values: ["1,234", "9,876", "5,555"],
    tabular: true,
    verify: (t) => verifyNoLateralShift(t, "1,234", "9,876"),
  },
  {
    label: "Tabular currency counter",
    description:
      "A live price ticking under tabular figures: the $, the separators and the decimal all hold their columns while the digits swap underneath them.",
    tags: ["tabular", "currency", "counter"],
    values: ["$1,234.50", "$9,876.50", "$5,555.55"],
    tabular: true,
    verify: (t) => verifyNoLateralShift(t, "$1,234.50", "$9,876.50", 4),
  },
  {
    label: "Tabular width change",
    description:
      "Crossing a magnitude adds a column, so the number legitimately gets wider. Everything to the right of the new digit still holds its own place — the row grows, it does not slide.",
    tags: ["tabular", "separator"],
    values: ["9,999", "10,000"],
    tabular: true,
    verify: (t) =>
      verifyPlaces(t, "9,999", "10,000", [
        [2, 1],
        [0, null],
      ]),
  },

  // ── Edges ──
  {
    label: "Repeated digit shrinks",
    description:
      "Which of four identical 1s survives? Place matching keeps the rightmost three — the units digit stays the units digit — rather than the leftmost, which would shift the whole number one column left.",
    tags: ["repeat", "place"],
    values: ["1111", "111", "11", "1"],
    verify: (t) => verifyAlignment(t, "1111", "111", [1, 2, 3]),
  },
  {
    label: "Empty and back",
    description:
      "Nothing to match against, so both characters enter fresh. Collapsing to zero width is the rough edge here — watch the container, not the diff.",
    tags: ["empty", "container"],
    values: ["", "42", ""],
    verify: (t) =>
      combineResults(
        verifyAlignment(t, "", "42", [null, null]),
        verifyUniqueIds(t, ["", "42", ""]),
      ),
  },

  // ── Invariants ──
  {
    label: "IDs stay unique",
    description:
      "IDs address DOM children, so a repeat inside one value would make two characters fight over the same node.",
    tags: ["ids", "spam"],
    values: ["1", "11", "111", "1,111", "11,111", "1,111", "111", "11", "1"],
    verify: (t) =>
      verifyUniqueIds(t, [
        "1",
        "11",
        "111",
        "1,111",
        "11,111",
        "1,111",
        "111",
        "11",
        "1",
      ]),
  },
];

export const ALL_NUMBER_TAGS = [
  ...new Set(NUMBER_CASES.flatMap((c) => c.tags)),
].sort();
