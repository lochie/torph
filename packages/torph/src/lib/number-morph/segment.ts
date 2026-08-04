export type NumberSegment = {
  id: string;
  string: string;
  kind: "digit" | "symbol";
};

let nextNewId = 0;

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function classifyKind(char: string): NumberSegment["kind"] {
  return isDigit(char) ? "digit" : "symbol";
}

const separators = new Map<string, string>();

/** The locale's decimal separator — the pivot every alignment is measured from. */
export function decimalSeparator(locale: string): string {
  const cached = separators.get(locale);
  if (cached) return cached;

  let separator = ".";
  try {
    separator =
      new Intl.NumberFormat(locale)
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? ".";
  } catch {
    // Invalid locale tag. `toLocaleString` surfaces it on the first number.
  }

  separators.set(locale, separator);
  return separator;
}

/**
 * Segments a string into per-character NumberSegments.
 *
 * When `cursorIndex` is provided, uses position-based matching:
 * characters before the edit keep their old IDs by position,
 * characters after the edit keep theirs offset by the length change.
 *
 * When `cursorIndex` is not provided, characters are matched by place
 * value \u2014 see `placeMatch`.
 */
export function segmentNumber(
  value: string,
  prevSegments?: NumberSegment[],
  cursorIndex?: number,
  decimalChar = ".",
): NumberSegment[] {
  const chars = value.split("");

  if (!prevSegments || prevSegments.length === 0) {
    return simpleSegment(chars);
  }

  const oldChars = prevSegments.map((s) =>
    s.string === "\u00A0" ? " " : s.string,
  );

  const matches =
    cursorIndex != null
      ? cursorMatch(oldChars, chars, cursorIndex)
      : placeMatch(oldChars, chars, decimalChar);

  const usedIds = new Set<string>();
  for (const [, oldIdx] of matches) {
    usedIds.add(prevSegments[oldIdx]!.id);
  }

  const result: NumberSegment[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;
    const kind = classifyKind(char);
    const displayChar = char === " " ? "\u00A0" : char;

    if (matches.has(i)) {
      const oldIdx = matches.get(i)!;
      result.push({
        id: prevSegments[oldIdx]!.id,
        string: displayChar,
        kind,
      });
    } else {
      let id = `${char}_n${nextNewId++}`;
      while (usedIds.has(id)) {
        id = `${char}_n${nextNewId++}`;
      }
      usedIds.add(id);
      result.push({ id, string: displayChar, kind });
    }
  }

  return result;
}

/** Occurrence-based segmentation for initial render. */
function simpleSegment(chars: string[]): NumberSegment[] {
  const counts = new Map<string, number>();

  return chars.map((char) => {
    const kind = classifyKind(char);
    const count = counts.get(char) ?? 0;
    counts.set(char, count + 1);

    if (char === " ") {
      return {
        id: count > 0 ? `space_${count}` : "space",
        string: "\u00A0",
        kind,
      };
    }

    return {
      id: count > 0 ? `${char}_${count}` : char,
      string: char,
      kind,
    };
  });
}

/**
 * Position-based matching using cursor position.
 * The cursor in the NEW string tells us where the edit happened:
 * - Insertion: chars were added just before cursor. Prefix [0, cursor-inserted)
 *   maps 1:1, suffix [cursor, end) maps to old [cursor-inserted, end).
 * - Deletion: chars were removed. Prefix [0, cursor) maps 1:1,
 *   suffix [cursor, end) maps to old [cursor+deleted, end).
 */
function cursorMatch(
  oldChars: string[],
  newChars: string[],
  cursor: number,
): Map<number, number> {
  const matches = new Map<number, number>();
  const lenDiff = newChars.length - oldChars.length;

  if (lenDiff > 0) {
    const editStart = cursor - lenDiff;
    for (let i = 0; i < editStart && i < oldChars.length; i++) {
      matches.set(i, i);
    }
    for (let i = cursor; i < newChars.length; i++) {
      const oldIdx = i - lenDiff;
      if (oldIdx >= 0 && oldIdx < oldChars.length) {
        matches.set(i, oldIdx);
      }
    }
  } else if (lenDiff < 0) {
    for (let i = 0; i < cursor && i < newChars.length; i++) {
      matches.set(i, i);
    }
    for (let i = cursor; i < newChars.length; i++) {
      const oldIdx = i - lenDiff;
      if (oldIdx >= 0 && oldIdx < oldChars.length) {
        matches.set(i, oldIdx);
      }
    }
  } else {
    for (let i = 0; i < newChars.length; i++) {
      if (newChars[i] === oldChars[i]) {
        matches.set(i, i);
      }
    }
  }

  return matches;
}

/**
 * Matches characters by place value rather than by scanning left to right.
 *
 * A digit's identity is its significance: the units digit stays the units digit
 * however many digits appear in front of it. So the integer side is walked
 * outward from the decimal separator towards the left and the fraction side
 * towards the right, pairing whatever sits at the same distance from the pivot.
 * Group separators fall into place as a side effect — 999,999 → 1,000,000 slides
 * its comma along by one group, where a left-to-right scan would snap it to the
 * front and break the cadence.
 *
 * Fixed affixes ($, %, " MB") aren't part of the number, so they are paired from
 * the outside in first and excluded from the place alignment.
 *
 * Returns a Map of newIndex → oldIndex for matched characters. Both walks skip
 * over mismatches instead of stopping: one digit changing says nothing about the
 * alignment of the digits either side of it.
 */
function placeMatch(
  oldChars: string[],
  newChars: string[],
  decimalChar: string,
): Map<number, number> {
  const matches = new Map<number, number>();

  let start = 0;
  while (
    start < oldChars.length &&
    start < newChars.length &&
    oldChars[start] === newChars[start] &&
    !isDigit(oldChars[start]!)
  ) {
    matches.set(start, start);
    start++;
  }

  let oldEnd = oldChars.length;
  let newEnd = newChars.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldChars[oldEnd - 1] === newChars[newEnd - 1] &&
    !isDigit(oldChars[oldEnd - 1]!)
  ) {
    matches.set(newEnd - 1, oldEnd - 1);
    oldEnd--;
    newEnd--;
  }

  const oldPivot = findPivot(oldChars, start, oldEnd, decimalChar);
  const newPivot = findPivot(newChars, start, newEnd, decimalChar);

  for (let k = 1; oldPivot - k >= start && newPivot - k >= start; k++) {
    if (oldChars[oldPivot - k] === newChars[newPivot - k]) {
      matches.set(newPivot - k, oldPivot - k);
    }
  }

  // Absent from either value, the pivot is that value's end and there is no
  // fraction to walk.
  if (oldPivot < oldEnd && newPivot < newEnd) {
    matches.set(newPivot, oldPivot);

    for (let k = 1; oldPivot + k < oldEnd && newPivot + k < newEnd; k++) {
      if (oldChars[oldPivot + k] === newChars[newPivot + k]) {
        matches.set(newPivot + k, oldPivot + k);
      }
    }
  }

  return matches;
}

/** Last decimal separator within the affix-trimmed range, else the range end. */
function findPivot(
  chars: string[],
  start: number,
  end: number,
  decimalChar: string,
): number {
  for (let i = end - 1; i >= start; i--) {
    if (chars[i] === decimalChar) return i;
  }
  return end;
}
