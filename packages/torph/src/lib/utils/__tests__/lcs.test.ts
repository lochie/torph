import { describe, expect, it } from "vitest";
import { lcsIndices } from "../lcs";

function longestLength(a: string[], b: string[]): number {
  let longest = 0;
  for (let mask = 0; mask < 1 << a.length; mask++) {
    let cursor = 0;
    let length = 0;
    for (let i = 0; i < a.length; i++) {
      if (!(mask & (1 << i))) continue;
      const next = b.indexOf(a[i]!, cursor);
      if (next < 0) {
        length = -1;
        break;
      }
      cursor = next + 1;
      length++;
    }
    longest = Math.max(longest, length);
  }
  return longest;
}

describe("LCS identities", () => {
  it("preserves forward tie breaking with repeated tokens", () => {
    expect(lcsIndices(["a"], ["a", "a"])).toEqual([[0], [0]]);
    expect(lcsIndices(["a", "b"], ["b", "a"])).toEqual([[1], [0]]);
    expect(lcsIndices(["a", "a", "b"], ["a", "b", "a"])).toEqual([
      [0, 2],
      [0, 1],
    ]);
  });

  it("handles identical sequences, append-only changes and empty inputs", () => {
    expect(lcsIndices([], ["a"])).toEqual([[], []]);
    expect(lcsIndices(["a"], [])).toEqual([[], []]);
    expect(lcsIndices(["a", "b"], ["a", "b", "c"])).toEqual([
      [0, 1],
      [0, 1],
    ]);
    expect(lcsIndices(["a", "b"], ["a", "b"])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("finds an optimal ordered match against exhaustive subsequences", () => {
    let seed = 1729;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let sample = 0; sample < 400; sample++) {
      const a = Array.from({ length: random() % 9 }, () =>
        String(random() % 3),
      );
      const b = Array.from({ length: random() % 9 }, () =>
        String(random() % 3),
      );
      const [ai, bi] = lcsIndices(a, b);
      expect(ai.length).toBe(longestLength(a, b));
      expect(ai.map((i) => a[i])).toEqual(bi.map((i) => b[i]));
      expect(ai.every((value, i) => i === 0 || value > ai[i - 1]!)).toBe(true);
      expect(bi.every((value, i) => i === 0 || value > bi[i - 1]!)).toBe(true);
    }
  });
});
