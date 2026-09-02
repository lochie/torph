import type { Segment, SegmentKind } from "../../utils/types";
import { lcsIndices } from "../../utils/lcs";

export type NumberSegment = Segment & { kind: SegmentKind };

/**
 * Numeric IDs share one namespace with the text segments around them, and a
 * collision between the two would hand one DOM node to two characters. Text IDs
 * are derived from the text itself, so a prefix that cannot occur in content
 * keeps the two sets disjoint by construction, and a counter that only ever
 * climbs keeps every minted ID unique for the life of the page — including
 * against an ID a number is still carrying from several morphs ago.
 */
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

/**
 * What is left of a token once the volatile part of a quantity is removed.
 *
 * Digits and the separators between them are exactly what a number is expected
 * to churn through, so they say nothing about whether two tokens are the same
 * thing. What is left — "$", "%", "()" — is the part that holds still, and two
 * tokens sharing it are the same figure at different magnitudes.
 */
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
 * Whether a whitespace-delimited token is a quantity, and so should morph by
 * place value rather than by character.
 *
 * The test is deliberately strict — the whole token has to be a number, give or
 * take a currency symbol on the front and punctuation on the back. Merely
 * *containing* a digit is not enough: "COVID-19", "GPT-4" and "2024-01-01" all
 * do, and none of them has a units column. Reading them as numbers would slide
 * their letters around on a rule no one asked for, and this is on by default.
 *
 * Trailing sentence punctuation is stripped first, so the figure in "it cost
 * $1,234." is still a figure.
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

  const oldDigits = integerDigits(oldChars, start, oldPivot);
  const newDigits = integerDigits(newChars, start, newPivot);

  // Affixes still hold: the currency a figure is denominated in did not change
  // just because the figure did, and `matches` already holds them.
  //
  // A side with no digits at all is not a magnitude — it is a field being typed
  // into or emptied out, where every character that survives should be seen to.
  if (
    oldDigits > 0 &&
    newDigits > 0 &&
    Math.abs(oldDigits - newDigits) >= MAGNITUDE_JUMP
  ) {
    return matches;
  }

  // A group separator holds its distance from the pivot — that is what slides
  // it one group along on 999,999 → 1,000,000 instead of snapping it to the
  // front — but only while the digits have not been re-shaped underneath it.
  //
  // Once a run of digits carries across, the separator would have to cross
  // through that run to reach its new distance, the two passing in opposite
  // directions. It is a boundary between groups, and after a reshape it is not
  // the same boundary, so it leaves and a new one arrives. Where no digit
  // persisted, nothing contradicts it and the slide is the only continuity the
  // number has.
  const reshaped = matchDigits(start, oldPivot, start, newPivot, true);
  if (!reshaped) {
    for (let k = 1; oldPivot - k >= start && newPivot - k >= start; k++) {
      matchSeparator(oldPivot - k, newPivot - k);
    }
  }

  // Absent from either value, the pivot is that value's end and there is no
  // fraction to walk.
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
   * Pairs the digits on one side of the pivot.
   *
   * Same count of them and a digit's column is its identity: the units digit is
   * still the units digit, so they pair off by position and a changed digit
   * simply rolls in place.
   *
   * A different count, on the integer side only, means the number changed shape
   * rather than just value — it grew a column, or had a digit pushed into it —
   * and the reading that matches is which digits are *the same digits*. They
   * pair by longest common subsequence, so the run they share slides across to
   * its new magnitude instead of every column being rebuilt around it.
   *
   * The fraction side never does this. Its columns are fixed by their distance
   * from the decimal point, so lengthening or shortening it adds and removes
   * digits at the far end without disturbing the ones already there: 1.5 → 1.25
   * is the tenths changing and a hundredths arriving, not the 5 sliding over.
   *
   * `towardsPivot` is the tie-break, and only repeated digits notice it. Four 1s
   * becoming three has no single answer from the subsequence alone, and the one
   * that reads correctly is the number losing its *leading* digit — so ties go
   * to the end nearest the pivot, which is where a number is anchored.
   */
  /** Returns whether digits carried across a change of shape. */
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

/**
 * How many orders of magnitude apart two values have to be before the morph
 * stops being a morph.
 *
 * Under it, a number is the same quantity moving and every column that survived
 * should be seen to survive. Over it, the two are barely the same figure: their
 * widths differ so much that the outgoing and incoming digits overlap into an
 * unreadable smear, each one fading in or out at a position the other value
 * never occupied. Nothing carrying across is the honest description of that, and
 * it lets the whole run be replaced as one gesture instead of column by column.
 *
 * Three is where the corpus divides. Every case that has to keep its slide sits
 * at one or zero; every case that reads as a replacement sits at three or more.
 */
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
