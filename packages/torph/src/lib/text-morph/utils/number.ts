import type { Segment, SegmentKind } from "../../utils/types";
import { lcsIndices } from "../../utils/lcs";

export type NumberSegment = Segment & { kind: SegmentKind };

// Numeric and text IDs share a namespace. A NULL prefix cannot occur in a text-derived
// ID, and the counter only climbs, so neither can collide with the other.
const MINTED_PREFIX = "\u0000n";
let nextNewId = 0;

function mintId(): string {
  return `${MINTED_PREFIX}${nextNewId++}`;
}

export function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

export function hasDigit(value: string): boolean {
  for (const char of value) {
    if (isDigit(char)) return true;
  }
  return false;
}

/** What is left of a token once its digits and separators go — "$", "%", "()". */
export function numericSkeleton(word: string): string {
  let out = "";
  for (const char of word) {
    if (!isDigit(char) && !CORE_SEPARATORS.includes(char)) out += char;
  }
  return out;
}

/** Separators that can appear *between* digits without ending the number. */
const CORE_SEPARATORS = ".,'\u00A0\u202F\u2009\u2007";
const PREFIX_CHARS = "+-\u2212(#";
const SUFFIX_CHARS = "%.,!?:;)\"'\u201D\u2019";
const CURRENCY = /\p{Sc}/u;

function isAffix(char: string, set: string): boolean {
  return set.includes(char) || CURRENCY.test(char);
}

/**
 * Whether a token is a quantity. Strict on purpose, and on by default: merely
 * containing a digit is not enough, or "COVID-19" and "2024-01-01" morph by place.
 */
export function isNumericWord(word: string): boolean {
  let start = 0;
  let end = word.length;

  while (start < end && isAffix(word[start]!, PREFIX_CHARS)) start++;
  while (end > start && isAffix(word[end - 1]!, SUFFIX_CHARS)) end--;

  if (start >= end) return false;
  if (!isDigit(word[start]!) || !isDigit(word[end - 1]!)) return false;

  for (let i = start; i < end; i++) {
    const char = word[i]!;
    if (!isDigit(char) && !CORE_SEPARATORS.includes(char)) return false;
  }

  return true;
}

export function classifyKind(char: string): SegmentKind {
  return isDigit(char) ? "digit" : "symbol";
}

const separators = new Map<string, string>();

/** The locale's decimal separator — the pivot every alignment is measured from. */
export function decimalSeparator(locale: Intl.LocalesArgument): string {
  const key = String(locale);
  const cached = separators.get(key);
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

  separators.set(key, separator);
  return separator;
}

/** Per-character segments, matched by caret where `cursorIndex` is given, else by place. */
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
      ? cursorMatch(oldChars, chars, cursorIndex, decimalChar)
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
      let id = mintId();
      while (usedIds.has(id)) {
        id = mintId();
      }
      usedIds.add(id);
      result.push({ id, string: displayChar, kind });
    }
  }

  return result;
}

/** Fresh segmentation for a number with nothing to carry over from. */
function simpleSegment(chars: string[]): NumberSegment[] {
  return chars.map((char) => ({
    id: mintId(),
    string: char === " " ? "\u00A0" : char,
    kind: classifyKind(char),
  }));
}

/**
 * The caret in the new string says where the edit was; both sides of it map across.
 *
 * The walk is over everything *but* the grouping separators. A comma reflows with the
 * magnitude rather than with the keystroke, so counting it into the edit would shear
 * every match past the caret — typing a digit that carries "123" to "1,234" is a
 * two-character delta of which the user typed one, and they are not adjacent.
 */
function cursorMatch(
  oldChars: string[],
  newChars: string[],
  cursor: number,
  decimalChar: string,
): Map<number, number> {
  const matches = new Map<number, number>();

  const oldKept = keptIndices(oldChars, decimalChar);
  const newKept = keptIndices(newChars, decimalChar);
  const pair = (ni: number, oi: number) =>
    matches.set(newKept[ni]!, oldKept[oi]!);

  let keptCursor = 0;
  while (keptCursor < newKept.length && newKept[keptCursor]! < cursor)
    keptCursor++;

  const lenDiff = newKept.length - oldKept.length;

  if (lenDiff > 0) {
    const editStart = keptCursor - lenDiff;
    for (let i = 0; i < editStart && i < oldKept.length; i++) {
      pair(i, i);
    }
    for (let i = keptCursor; i < newKept.length; i++) {
      const oldIdx = i - lenDiff;
      if (oldIdx >= 0 && oldIdx < oldKept.length) {
        pair(i, oldIdx);
      }
    }
  } else if (lenDiff < 0) {
    for (let i = 0; i < keptCursor && i < newKept.length; i++) {
      pair(i, i);
    }
    for (let i = keptCursor; i < newKept.length; i++) {
      const oldIdx = i - lenDiff;
      if (oldIdx >= 0 && oldIdx < oldKept.length) {
        pair(i, oldIdx);
      }
    }
  } else {
    for (let i = 0; i < newKept.length; i++) {
      if (newChars[newKept[i]!] === oldChars[oldKept[i]!]) {
        pair(i, i);
      }
    }
  }

  // Paired from the units end, so the thousands comma stays the thousands comma.
  const oldSeps = groupingIndices(oldChars, decimalChar);
  const newSeps = groupingIndices(newChars, decimalChar);
  for (let k = 1; k <= oldSeps.length && k <= newSeps.length; k++) {
    const oldIdx = oldSeps[oldSeps.length - k]!;
    const newIdx = newSeps[newSeps.length - k]!;
    if (oldChars[oldIdx] === newChars[newIdx]) matches.set(newIdx, oldIdx);
  }

  return matches;
}

function isGrouping(char: string, decimalChar: string): boolean {
  return char !== decimalChar && CORE_SEPARATORS.includes(char);
}

function keptIndices(chars: string[], decimalChar: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (!isGrouping(chars[i]!, decimalChar)) indices.push(i);
  }
  return indices;
}

function groupingIndices(chars: string[], decimalChar: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (isGrouping(chars[i]!, decimalChar)) indices.push(i);
  }
  return indices;
}

/**
 * Pairs characters by distance from the decimal separator, not left to right — a
 * digit's identity is its column. Both walks skip mismatches rather than stopping.
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

  const oldDigits = integerDigits(oldChars, start, oldPivot);
  const newDigits = integerDigits(newChars, start, newPivot);

  // A side with no digits is a field being typed into or emptied, not a magnitude.
  if (
    oldDigits > 0 &&
    newDigits > 0 &&
    Math.abs(oldDigits - newDigits) >= MAGNITUDE_JUMP
  ) {
    return matches;
  }

  // A separator holds its distance from the pivot — what slides the comma one group
  // along on 999,999 → 1,000,000. After a reshape it would have to cross the digits
  // that carried, the two passing in opposite directions, so it leaves instead.
  const reshaped = matchDigits(start, oldPivot, start, newPivot, true);
  if (!reshaped) {
    for (let k = 1; oldPivot - k >= start && newPivot - k >= start; k++) {
      matchSeparator(oldPivot - k, newPivot - k);
    }
  }

  // Absent from either value, the pivot is that value's end.
  if (oldPivot < oldEnd && newPivot < newEnd) {
    matches.set(newPivot, oldPivot);

    for (let k = 1; oldPivot + k < oldEnd && newPivot + k < newEnd; k++) {
      matchSeparator(oldPivot + k, newPivot + k);
    }
    matchDigits(oldPivot + 1, oldEnd, newPivot + 1, newEnd, false);
  }

  function matchSeparator(oldIndex: number, newIndex: number) {
    const char = oldChars[oldIndex]!;
    if (isDigit(char)) return;
    if (char === newChars[newIndex]) matches.set(newIndex, oldIndex);
  }

  /**
   * Pairs the digits on one side of the pivot, by column where the count matches and by
   * subsequence where it changed. Reshaping is integer-side only — a fraction's columns
   * are fixed by the decimal point, so 1.5 → 1.25 gains a hundredths rather than sliding
   * the 5. `towardsPivot` breaks ties on repeated digits towards the units column.
   * Returns whether digits survived a reshape.
   */
  function matchDigits(
    oldFrom: number,
    oldTo: number,
    newFrom: number,
    newTo: number,
    towardsPivot: boolean,
  ): boolean {
    const oldIndices = digitIndices(oldChars, oldFrom, oldTo);
    const newIndices = digitIndices(newChars, newFrom, newTo);

    if (oldIndices.length === newIndices.length || !towardsPivot) {
      const pairs = Math.min(oldIndices.length, newIndices.length);
      for (let k = 0; k < pairs; k++) {
        const oi = oldIndices[k]!;
        const ni = newIndices[k]!;
        if (oldChars[oi] === newChars[ni]) matches.set(ni, oi);
      }
      return false;
    }

    // Reversed, so the subsequence walk resolves its ties from the units end.
    const oldRun = oldIndices.map((i) => oldChars[i]!).reverse();
    const newRun = newIndices.map((i) => newChars[i]!).reverse();
    const [ai, bi] = lcsIndices(oldRun, newRun);

    for (let k = 0; k < ai.length; k++) {
      const oi = oldIndices[oldIndices.length - 1 - ai[k]!]!;
      const ni = newIndices[newIndices.length - 1 - bi[k]!]!;
      matches.set(ni, oi);
    }

    return ai.length > 0;
  }

  return matches;
}

function digitIndices(chars: string[], from: number, to: number): number[] {
  const indices: number[] = [];
  for (let i = from; i < to; i++) if (isDigit(chars[i]!)) indices.push(i);
  return indices;
}

// Past this the digits overlap into a smear and nothing should carry across. Three is
// where the corpus divides: cases needing their slide sit at 0-1, replacements at 3+.
const MAGNITUDE_JUMP = 3;

function integerDigits(chars: string[], start: number, pivot: number): number {
  let count = 0;
  for (let i = start; i < pivot; i++) if (isDigit(chars[i]!)) count++;
  return count;
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
