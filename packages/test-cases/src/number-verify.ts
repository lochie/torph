import type { NumberSegment, NumberTorphApi, Result } from "./types";

export type AlignOptions = {
  /** Caret position in `to`, switching the step to cursor matching. */
  cursor?: number;
  decimalChar?: string;
};

/**
 * Where each character of `to` came from in `from`, by index — `null` for a
 * character that entered rather than persisted.
 *
 * This is the honest description of a morph: it is exactly what the FLIP pass
 * consumes, so asserting on it asserts on the cadence you actually see.
 */
export function alignment(
  t: NumberTorphApi,
  from: string,
  to: string,
  options: AlignOptions = {},
): (number | null)[] {
  const before = t.segmentNumber(from);
  const after = t.segmentNumber(
    to,
    before,
    options.cursor,
    options.decimalChar ?? ".",
  );
  const positions = new Map(before.map((segment, i) => [segment.id, i]));

  return after.map((segment) => positions.get(segment.id) ?? null);
}

function render(places: (number | null)[]): string {
  return `[${places.map((p) => (p === null ? "·" : p)).join(",")}]`;
}

/** The whole alignment, exactly. Use when every character's origin matters. */
export function verifyAlignment(
  t: NumberTorphApi,
  from: string,
  to: string,
  expected: (number | null)[],
  options: AlignOptions = {},
): Result {
  const places = alignment(t, from, to, options);
  const pass =
    places.length === expected.length &&
    places.every((p, i) => p === expected[i]);

  return {
    pass,
    detail: pass
      ? `${render(places)} as expected`
      : `expected ${render(expected)}, got ${render(places)}`,
  };
}

/**
 * Individual `[newIndex, oldIndex]` pairs. Use when only some characters carry
 * the meaning of the case and the rest are free to land wherever.
 */
export function verifyPlaces(
  t: NumberTorphApi,
  from: string,
  to: string,
  pairs: [newIndex: number, oldIndex: number | null][],
  options: AlignOptions = {},
): Result {
  const places = alignment(t, from, to, options);
  const wrong = pairs.filter(([newIndex, oldIndex]) => places[newIndex] !== oldIndex);

  return {
    pass: wrong.length === 0,
    detail: wrong.length
      ? wrong
          .map(
            ([newIndex, oldIndex]) =>
              `"${to[newIndex]}" at ${newIndex} should come from ${
                oldIndex === null ? "nowhere" : oldIndex
              }, came from ${places[newIndex] ?? "nowhere"}`,
          )
          .join("; ")
      : `${pairs.length} place${pairs.length === 1 ? "" : "s"} held ${render(places)}`,
  };
}

/** How many characters persisted at all — a floor on the morph's continuity. */
export function verifyPersistedCount(
  t: NumberTorphApi,
  from: string,
  to: string,
  min: number,
  options: AlignOptions = {},
): Result {
  const places = alignment(t, from, to, options);
  const held = places.filter((p) => p !== null).length;

  return {
    pass: held >= min,
    detail:
      held >= min
        ? `${held} of ${places.length} characters persisted`
        : `only ${held} characters persisted, expected at least ${min}`,
  };
}

/**
 * IDs address DOM children, so a repeat within one segmentation would make two
 * characters fight over the same node.
 */
export function verifyUniqueIds(
  t: NumberTorphApi,
  values: string[],
  options: AlignOptions = {},
): Result {
  let prev: NumberSegment[] | undefined;

  for (const value of values) {
    const segments = t.segmentNumber(
      value,
      prev,
      options.cursor,
      options.decimalChar ?? ".",
    );
    const ids = segments.map((s) => s.id);
    const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);

    if (duplicate) {
      return { pass: false, detail: `"${value}" repeats ID ${duplicate}` };
    }
    prev = segments;
  }

  return { pass: true, detail: `IDs unique across ${values.length} steps` };
}

/**
 * A character that never leaves the number must keep one identity across a
 * round trip, or it re-enters on every tick of a counter.
 */
export function verifyNumberCycleStability(
  t: NumberTorphApi,
  a: string,
  b: string,
  anchorIndex: number,
  options: AlignOptions = {},
): Result {
  const decimalChar = options.decimalChar ?? ".";
  let segments = t.segmentNumber(a);
  const anchor = segments[anchorIndex];

  if (!anchor) {
    return { pass: false, detail: `no character at index ${anchorIndex} of "${a}"` };
  }

  for (let i = 0; i < 4; i++) {
    const next = i % 2 === 0 ? b : a;
    segments = t.segmentNumber(next, segments, undefined, decimalChar);

    if (!segments.some((s) => s.id === anchor.id)) {
      return {
        pass: false,
        detail: `"${anchor.string}" (${anchor.id}) dropped at cycle ${i + 1} ("${next}")`,
      };
    }
  }

  const landed = segments.findIndex((s) => s.id === anchor.id);
  const pass = landed === anchorIndex;

  return {
    pass,
    detail: pass
      ? `"${anchor.string}" stable at index ${anchorIndex} across 4 cycles`
      : `"${anchor.string}" returned to index ${landed}, not ${anchorIndex}`,
  };
}

/**
 * Every character that persists lands on the index it came from.
 *
 * This is the condition tabular figures depend on. Tabular numerals give every
 * digit the same advance width, so a same-length morph can be perfectly still
 * horizontally — but only if the diff agrees that nothing moved. One persisted
 * character mapped to a different index and the whole row slides, and against a
 * monospaced grid that reads as a bug rather than as motion.
 *
 * `minPersisted` guards the vacuous pass: a diff where nothing persists at all
 * has no lateral shift either, and is not what this is asserting.
 */
export function verifyNoLateralShift(
  t: NumberTorphApi,
  from: string,
  to: string,
  minPersisted = 1,
  options: AlignOptions = {},
): Result {
  const places = alignment(t, from, to, options);
  const held = places.filter((p) => p !== null).length;

  if (held < minPersisted) {
    return {
      pass: false,
      detail: `only ${held} characters persisted, expected at least ${minPersisted}`,
    };
  }

  const shifted = places
    .map((origin, i) => ({ origin, i }))
    .filter(({ origin, i }) => origin !== null && origin !== i);

  return {
    pass: shifted.length === 0,
    detail: shifted.length
      ? shifted
          .map(({ origin, i }) => `"${to[i]}" slides ${origin} → ${i}`)
          .join("; ")
      : `${held} characters held their column`,
  };
}
