import type { Segment } from "./segment";
import { createIdAllocator, groupIntoWords, segmentText } from "./segment";
import { lcsIndices } from "../../utils/lcs";
import type { NumberSegment } from "./number";
import {
  classifyKind,
  decimalSeparator,
  hasDigit,
  isNumericWord,
  numericSkeleton,
  segmentNumber,
} from "./number";

export type DiffResult = {
  segments: Segment[];
  splits: Map<string, Segment[]>;
};

export type DiffOptions = {
  /** Numeric words morph by place value. Off falls back to character LCS. */
  numbers?: boolean;
  /** Caret position, honoured only when the value holds a single number. */
  cursorIndex?: number;
};

// Numbers share too few characters to pair with each other, so they all collapse to one token.
const NUMBER_TOKEN = "\u0000#";

/** Per-character segments of an old word, cutting it up first if it is still one span. */
function splitIfWhole(
  oldGroup: { word: string; segments: Segment[] },
  splits: Map<string, Segment[]>,
): Segment[] {
  // Cutting a one-character word mints a new ID for a character that never moved.
  if (oldGroup.segments.length !== 1 || oldGroup.word.length <= 1) {
    return oldGroup.segments;
  }

  const wordSeg = oldGroup.segments[0]!;
  const charSegs = oldGroup.word.split("").map((char, i) => ({
    id: `${wordSeg.id}:${i}`,
    string: char,
  }));
  splits.set(wordSeg.id, charSegs);

  return charSegs;
}

/** Fills in kinds an older, non-numeric segmentation of the same word lacked. */
function asNumberSegments(segments: Segment[]): NumberSegment[] {
  return segments.map((seg) => ({
    ...seg,
    kind: seg.kind ?? classifyKind(seg.string),
  }));
}

/** How a new word gets its segments — the ID pre-pass and the build loop must agree. */
type WordPlan =
  | { mode: "fresh" }
  | { mode: "reuse"; oi: number }
  | { mode: "morph"; oi: number }
  | { mode: "number"; oi: number };

function charSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [matched] = lcsIndices(a.split(""), b.split(""));
  return matched.length / Math.max(a.length, b.length);
}

/** How many LCS matches sit before each word — the index of the gap it occupies. */
function gapIndices(count: number, matched: Set<number>): number[] {
  const gaps: number[] = [];
  let anchors = 0;
  for (let i = 0; i < count; i++) {
    gaps.push(anchors);
    if (matched.has(i)) anchors++;
  }
  return gaps;
}

const MIN_SIMILARITY = 0.4;

/** An old word's claim on a new one. A matching numeric skeleton beats shared characters. */
function pairAffinity(a: string, b: string): number {
  if (
    (hasDigit(a) || hasDigit(b)) &&
    numericSkeleton(a) === numericSkeleton(b)
  ) {
    return 1;
  }
  return charSimilarity(a, b);
}

// The diff runs before the first frame, so past these it degrades rather than blocks.
const MAX_MORPH_PAIRINGS = 2_500;
const MAX_LCS_CELLS = 1_000_000;

export function diffSegments(
  oldSegments: Segment[],
  newText: string,
  locale: Intl.LocalesArgument,
  options: DiffOptions = {},
): DiffResult {
  const newHasSpaces = newText.includes(" ");
  const newHasNewlines = newText.includes("\n");
  const oldWords = groupIntoWords(oldSegments);

  const numbersOn = options.numbers !== false;
  const isNum = (word: string) => numbersOn && isNumericWord(word);
  const token = (word: string) => (isNum(word) ? NUMBER_TOKEN : word);

  // Text IDs are derived from the text and survive re-segmentation; minted numeric IDs don't.
  const digitsInvolved =
    numbersOn && (hasDigit(newText) || oldWords.some((g) => hasDigit(g.word)));

  if (
    oldWords.length <= 1 &&
    !newHasSpaces &&
    !newHasNewlines &&
    !digitsInvolved
  ) {
    return {
      segments: segmentText(newText, locale, numbersOn),
      splits: new Map(),
    };
  }

  const newWordStrings: string[] = [];
  const newSeparators: string[][] = []; // separators BEFORE each word
  const parts = newText.split(/( |\n)/);
  let pendingSeps: string[] = [];
  for (const part of parts) {
    if (part === " " || part === "\n") {
      pendingSeps.push(part);
    } else if (part.length > 0) {
      newSeparators.push(pendingSeps);
      newWordStrings.push(part);
      pendingSeps = [];
    }
  }
  const trailingSeparators = pendingSeps;

  const oldWordStrings = oldWords.map((g) => g.word);

  if (oldWordStrings.length * newWordStrings.length > MAX_LCS_CELLS) {
    return {
      segments: segmentText(newText, locale, numbersOn),
      splits: new Map(),
    };
  }

  const [oldLcsIdx, newLcsIdx] = lcsIndices(
    oldWordStrings.map(token),
    newWordStrings.map(token),
  );
  const oldMatchedSet = new Set(oldLcsIdx);
  const newMatchedSet = new Set(newLcsIdx);

  const newToOldWord = new Map<number, number>();
  for (let k = 0; k < newLcsIdx.length; k++) {
    newToOldWord.set(newLcsIdx[k]!, oldLcsIdx[k]!);
  }

  let oldUnmatched = oldWordStrings
    .map((_, i) => i)
    .filter((i) => !oldMatchedSet.has(i));
  let newUnmatched = newWordStrings
    .map((_, i) => i)
    .filter((i) => !newMatchedSet.has(i));

  // Exact-match reordered words that LCS couldn't capture (order-preserving)
  const exactUsed = new Set<number>();
  for (const ni of newUnmatched) {
    for (const oi of oldUnmatched) {
      if (exactUsed.has(oi)) continue;
      if (token(newWordStrings[ni]!) === token(oldWordStrings[oi]!)) {
        newToOldWord.set(ni, oi);
        exactUsed.add(oi);
        break;
      }
    }
  }
  if (exactUsed.size > 0) {
    oldUnmatched = oldUnmatched.filter((i) => !exactUsed.has(i));
    newUnmatched = newUnmatched.filter((i) => !newToOldWord.has(i));
  }

  const morphPairs = new Map<number, number>();
  const usedOld = new Set<number>();

  // From the LCS alone: the exact-match pass reorders, so its pairs anchor nothing.
  const oldGaps = gapIndices(oldWordStrings.length, oldMatchedSet);
  const newGaps = gapIndices(newWordStrings.length, newMatchedSet);

  if (oldUnmatched.length * newUnmatched.length <= MAX_MORPH_PAIRINGS) {
    for (const ni of newUnmatched) {
      let bestOi = -1;
      let bestSim = MIN_SIMILARITY;

      for (const oi of oldUnmatched) {
        if (usedOld.has(oi)) continue;
        // A pairing that crosses a surviving word drags its characters the width of the value.
        if (oldGaps[oi] !== newGaps[ni]) continue;
        // Numbers and words pair freely; MIN_SIMILARITY keeps a number off a real word.
        const sim = pairAffinity(oldWordStrings[oi]!, newWordStrings[ni]!);
        if (sim > bestSim) {
          bestSim = sim;
          bestOi = oi;
        }
      }

      if (bestOi >= 0) {
        morphPairs.set(ni, bestOi);
        usedOld.add(bestOi);
      }
    }
  }

  // Keyed on what the word is becoming, not on what it was.
  const plans: WordPlan[] = newWordStrings.map((newWord, ni): WordPlan => {
    const lcsOi = newToOldWord.get(ni);
    const oi = lcsOi ?? morphPairs.get(ni);
    if (oi === undefined) return { mode: "fresh" };
    if (isNum(newWord)) return { mode: "number", oi };
    return lcsOi !== undefined ? { mode: "reuse", oi } : { mode: "morph", oi };
  });

  // Meaningless once a value holds several figures.
  const cursorIndex =
    plans.filter((plan) => plan.mode === "number").length === 1
      ? options.cursorIndex
      : undefined;
  const decimalChar = decimalSeparator(locale);

  const alloc = createIdAllocator();

  // Reserved up front: an ID inherited later would otherwise go to an earlier segment.
  for (const plan of plans) {
    if (plan.mode === "fresh") continue;
    const oldGroup = oldWords[plan.oi]!;

    if (plan.mode !== "reuse" && oldGroup.segments.length === 1) {
      // About to be split into per-character spans
      const wordSeg = oldGroup.segments[0]!;
      for (let i = 0; i < oldGroup.word.length; i++) {
        alloc.reserve(`${wordSeg.id}:${i}`);
      }
    } else {
      for (const seg of oldGroup.segments) alloc.reserve(seg.id);
    }
  }

  const segments: Segment[] = [];
  const splits = new Map<string, Segment[]>();
  let charOffset = 0;

  // Includes the edges — segmentText keeps leading and trailing whitespace on first render.
  function pushSeparators(seps: string[]) {
    for (const sep of seps) {
      if (sep === "\n") {
        segments.push({
          id: alloc.take(`newline-${charOffset}`),
          string: "\n",
        });
      } else {
        segments.push({
          id: alloc.take(`space-${charOffset}`),
          string: "\u00A0",
        });
      }
      charOffset++;
    }
  }

  for (let ni = 0; ni < newWordStrings.length; ni++) {
    pushSeparators(newSeparators[ni] ?? (ni > 0 ? [" "] : []));

    const plan = plans[ni]!;
    const newWord = newWordStrings[ni]!;

    if (plan.mode === "reuse") {
      for (const seg of oldWords[plan.oi]!.segments) segments.push(seg);
    } else if (plan.mode === "number") {
      const oldGroup = oldWords[plan.oi]!;

      segments.push(
        ...segmentNumber(
          newWord,
          asNumberSegments(splitIfWhole(oldGroup, splits)),
          cursorIndex === undefined ? undefined : cursorIndex - charOffset,
          decimalChar,
        ),
      );
    } else if (plan.mode === "morph") {
      const oldGroup = oldWords[plan.oi]!;
      const oldWord = oldGroup.word;
      const oldCharSegs = splitIfWhole(oldGroup, splits);

      const oldChars = oldWord.split("");
      const newChars = newWord.split("");
      const [oldCharLcs, newCharLcs] = lcsIndices(oldChars, newChars);

      const newCharToOldSeg = new Map<number, Segment>();
      for (let k = 0; k < newCharLcs.length; k++) {
        const oldSeg = oldCharSegs[oldCharLcs[k]!];
        if (oldSeg) {
          newCharToOldSeg.set(newCharLcs[k]!, oldSeg);
        }
      }

      for (let ci = 0; ci < newChars.length; ci++) {
        if (newCharToOldSeg.has(ci)) {
          const oldSeg = newCharToOldSeg.get(ci)!;
          segments.push({ id: oldSeg.id, string: newChars[ci]! });
        } else {
          segments.push({
            id: alloc.take(`${newWord}~${ci}`),
            string: newChars[ci]!,
          });
        }
      }
    } else if (isNum(newWord)) {
      segments.push(...segmentNumber(newWord));
    } else {
      segments.push({ id: alloc.take(newWord), string: newWord });
    }

    charOffset += newWord.length;
  }

  pushSeparators(trailingSeparators);

  return { segments, splits };
}
