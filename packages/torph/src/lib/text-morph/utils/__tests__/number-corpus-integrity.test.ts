import { describe, it, expect } from "vitest";
import { NUMBER_CASES } from "@torph/test-cases";
import type { NumberSegment, NumberTorphApi } from "@torph/test-cases";
import { segmentNumber } from "../number";

// Guards the corpus, not the library: a `verify` can pass without asserting
// anything and still look green. Each case is re-run against deliberately
// broken segmenters — passing under every one means it tests nothing.

type Saboteur = { name: string; api: NumberTorphApi };

const SABOTEURS: Saboteur[] = [
  {
    name: "nothing persists — every character gets a fresh ID",
    api: {
      segmentNumber: (value, prev, cursor, decimalChar) => {
        let n = 0;
        return segmentNumber(value, prev, cursor, decimalChar).map(
          (s: NumberSegment) => ({ ...s, id: `fresh-${n++}` }),
        );
      },
    },
  },
  {
    name: "identity is position — the units digit is whatever sits last",
    api: {
      segmentNumber: (value, prev, cursor, decimalChar) =>
        segmentNumber(value, prev, cursor, decimalChar).map(
          (s: NumberSegment, i: number) => ({ ...s, id: `at-${i}` }),
        ),
    },
  },
  {
    name: "identity is the character — every 0 in a value is the same 0",
    api: {
      segmentNumber: (value, prev, cursor, decimalChar) =>
        segmentNumber(value, prev, cursor, decimalChar).map(
          (s: NumberSegment) => ({ ...s, id: `char-${s.string}` }),
        ),
    },
  },
  {
    name: "frozen — the segmenter ignores the new value",
    api: {
      segmentNumber: (value, prev, cursor, decimalChar) =>
        prev?.length ? prev : segmentNumber(value, prev, cursor, decimalChar),
    },
  },
  {
    name: "empty output — the segmenter returns nothing",
    api: {
      segmentNumber: () => [],
    },
  },
];

describe("number corpus integrity", () => {
  it("every case is uniquely labelled", () => {
    const labels = NUMBER_CASES.map((c) => c.label);
    expect(new Set(labels).size, "duplicate case labels").toBe(labels.length);
  });

  it("every case has values to morph between", () => {
    for (const c of NUMBER_CASES) {
      expect(c.values.length, `"${c.label}" has no values`).toBeGreaterThan(0);
    }
  });

  it("every cursor track covers its values", () => {
    for (const c of NUMBER_CASES) {
      if (!c.cursors) continue;
      expect(
        c.cursors.length,
        `"${c.label}" has ${c.cursors.length} cursors for ${c.values.length} values`,
      ).toBe(c.values.length);
    }
  });

  it.each(NUMBER_CASES.map((c) => [c.label, c] as const))(
    "%s detects a broken segmenter",
    (_label, testCase) => {
      const survived = SABOTEURS.filter((s) => {
        try {
          return testCase.verify(s.api).pass;
        } catch {
          return false;
        }
      });

      expect(
        survived.length,
        `passes under every saboteur (${survived
          .map((s) => s.name)
          .join(", ")}) — this case does not actually assert library behaviour`,
      ).toBeLessThan(SABOTEURS.length);
    },
  );
});
