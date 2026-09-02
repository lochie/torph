import { describe, it, expect } from "vitest";
import { decimalSeparator, segmentNumber } from "../number";

/**
 * Where each character of `to` came from in `from`, by position — `null` for a
 * character that entered rather than persisted. This is what the FLIP pass
 * consumes, so it is the honest description of a morph's cadence.
 */
function alignment(from: string, to: string, decimalChar = ".") {
  const before = segmentNumber(from);
  const after = segmentNumber(to, before, undefined, decimalChar);
  const positions = new Map(before.map((segment, i) => [segment.id, i]));

  return after.map((segment) => positions.get(segment.id) ?? null);
}

describe("segmentNumber place matching", () => {
  it("slides a group separator along by one group", () => {
    // The comma belongs to the second group of 1,000,000, not the first: it is
    // the same separator moved up a magnitude, not a new one at the front.
    expect(alignment("999,999", "1,000,000")).toEqual([
      null,
      null,
      null,
      null,
      null,
      3,
      null,
      null,
      null,
    ]);
  });

  it("slides separators the other way when the value shrinks", () => {
    // The integer side lost a column, so the four digits it still has are the
    // four it had — they move down a magnitude rather than being replaced. The
    // separator does not go with them; it would have to cross the run.
    expect(alignment("12,345", "1,234")).toEqual([0, null, 1, 3, 4]);
  });

  it("pins a currency prefix across a magnitude jump", () => {
    const places = alignment("$999.50", "$1,000,000.00");

    expect(places[0]).toBe(0); // $ never moves
    // Four orders apart: the figure is replaced rather than morphed, so not
    // even the decimal point carries.
    expect(places[10]).toBeNull();
    expect(places[6]).toBeNull();
  });

  it("grows the fraction to the right", () => {
    expect(alignment("1.5", "1.55")).toEqual([0, 1, 2, null]);
  });

  it("grows the integer part to the left", () => {
    expect(alignment("99", "199")).toEqual([null, 0, 1]);
  });

  it("keeps a trailing unit when the fraction changes length", () => {
    expect(alignment("1.25 MB", "1.5 MB")).toEqual([0, 1, null, 4, 5, 6]);
  });

  it("keeps a trailing percent sign while digits shift", () => {
    expect(alignment("0%", "50%")).toEqual([null, 0, 1]);
  });

  it("matches by place across a mismatched digit", () => {
    // The changed hundreds digit says nothing about the digits either side.
    expect(alignment("1,234", "1,834")).toEqual([0, 1, null, 3, 4]);
  });

  it("holds fixed-width separators still", () => {
    expect(alignment("09:59", "10:00")).toEqual([null, null, 2, null, null]);
  });

  it("uses the locale's decimal separator as the pivot", () => {
    // de-DE: dots group, the comma is the pivot. The pivot holds and the
    // integer digits ride along; the group separator gives way rather than
    // crossing them, and the fraction keeps its columns, so 56 → 67 replaces
    // both of those.
    expect(alignment("1.234,56", "12.345,67", ",")).toEqual([
      0,
      2,
      null,
      3,
      4,
      null,
      5,
      null,
      null,
    ]);
  });

  it("prefers the cursor hint when one is given", () => {
    const before = segmentNumber("1234");
    const after = segmentNumber("12934", before, 3);
    const positions = new Map(before.map((segment, i) => [segment.id, i]));

    // Inserted at index 2, so everything after it keeps its old identity.
    expect(after.map((s) => positions.get(s.id) ?? null)).toEqual([
      0,
      1,
      null,
      2,
      3,
    ]);
  });
});

describe("decimalSeparator", () => {
  it("reads the separator from the locale", () => {
    expect(decimalSeparator("en")).toBe(".");
    expect(decimalSeparator("de-DE")).toBe(",");
  });

  it("falls back to a dot for an invalid locale", () => {
    expect(decimalSeparator("en_US")).toBe(".");
  });
});
