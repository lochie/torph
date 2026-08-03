import { describe, it, expect } from "vitest";
import { CASES } from "@torph/test-cases";
import type { Segment, TorphApi } from "@torph/test-cases";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";

// Guards the corpus, not the library: a `verify` can pass without asserting
// anything and still look green. Each case is re-run against deliberately
// broken implementations — passing under every one means it tests nothing.

type Saboteur = { name: string; api: TorphApi };

const SABOTEURS: Saboteur[] = [
  {
    name: "nothing persists — every segment gets a fresh ID",
    api: {
      segmentText,
      diffSegments: (old, next, locale) => {
        const { segments, splits } = diffSegments(old, next, locale);
        let n = 0;
        return {
          segments: segments.map((s: Segment) => ({
            ...s,
            id: `fresh-${n++}`,
          })),
          splits,
        };
      },
    },
  },
  {
    name: "nothing splits — character morphing never happens",
    api: {
      segmentText,
      diffSegments: (old, next, locale) => ({
        segments: diffSegments(old, next, locale).segments,
        splits: new Map<string, Segment[]>(),
      }),
    },
  },
  {
    name: "empty output — the diff returns no segments",
    api: {
      segmentText,
      diffSegments: () => ({
        segments: [],
        splits: new Map<string, Segment[]>(),
      }),
    },
  },
  {
    name: "frozen — the diff ignores the new value",
    api: {
      segmentText,
      diffSegments: (old) => ({
        segments: old,
        splits: new Map<string, Segment[]>(),
      }),
    },
  },
  {
    name: "no segmentation — the whole value is one segment",
    api: {
      segmentText: (value) =>
        value.length ? [{ id: value, string: value }] : [],
      diffSegments,
    },
  },
];

describe("corpus integrity", () => {
  it("every case is uniquely labelled", () => {
    const labels = CASES.map((c) => c.label);
    expect(new Set(labels).size, "duplicate case labels").toBe(labels.length);
  });

  it("every case has values to morph between", () => {
    for (const c of CASES) {
      expect(c.values.length, `"${c.label}" has no values`).toBeGreaterThan(0);
    }
  });

  it.each(CASES.map((c) => [c.label, c] as const))(
    "%s detects a broken library",
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
