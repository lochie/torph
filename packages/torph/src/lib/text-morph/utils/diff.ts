import type { Segment } from "./segment";
import { createIdAllocator, segmentText } from "./segment";

export type DiffResult = {
  segments: Segment[];
  splits: Map<string, Segment[]>;
};

type WordGroup = {
  word: string;
  segments: Segment[];
};

function groupIntoWords(segments: Segment[]): WordGroup[] {
  const groups: WordGroup[] = [];
  let current: Segment[] = [];

  for (const seg of segments) {
    if (seg.string === "\u00A0" || seg.string === "\n") {
      if (current.length > 0) {
        groups.push({
          word: current.map((s) => s.string).join(""),
          segments: [...current],
        });
        current = [];
      }
    } else {
      current.push(seg);
    }
  }
  if (current.length > 0) {
    groups.push({
      word: current.map((s) => s.string).join(""),
      segments: [...current],
    });
  }

  return groups;
}

/**
 * Longest common subsequence, reported as paired indices into `a` and `b`.
 *
 * Built over suffixes and walked *forwards* so ties resolve to the earliest
 * match — a repeated word keeps its element on the first occurrence. Walking
 * backwards resolves them the other way, and the text flies across the block.
 */
function lcsIndices(a: string[], b: string[]): [number[], number[]] {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = length of the LCS of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const ai: number[] = [];
  const bi: number[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ai.push(i);
      bi.push(j);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }

  return [ai, bi];
}

function charSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [matched] = lcsIndices(a.split(""), b.split(""));
  return matched.length / Math.max(a.length, b.length);
}

const MIN_SIMILARITY = 0.4;

// The whole diff runs synchronously before the first frame, so past these
// budgets it degrades the animation rather than blocking on a long value.
const MAX_MORPH_PAIRINGS = 2_500;
const MAX_LCS_CELLS = 1_000_000;

export function diffSegments(
  oldSegments: Segment[],
  newText: string,
  locale: Intl.LocalesArgument,
): DiffResult {
  const newHasSpaces = newText.includes(" ");
  const newHasNewlines = newText.includes("\n");
  const oldWords = groupIntoWords(oldSegments);

  if (oldWords.length <= 1 && !newHasSpaces && !newHasNewlines) {
    return { segments: segmentText(newText, locale), splits: new Map() };
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
    return { segments: segmentText(newText, locale), splits: new Map() };
  }

  const [oldLcsIdx, newLcsIdx] = lcsIndices(oldWordStrings, newWordStrings);
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
      if (newWordStrings[ni] === oldWordStrings[oi]) {
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

  if (oldUnmatched.length * newUnmatched.length <= MAX_MORPH_PAIRINGS) {
    for (const ni of newUnmatched) {
      let bestOi = -1;
      let bestSim = MIN_SIMILARITY;

      for (const oi of oldUnmatched) {
        if (usedOld.has(oi)) continue;
        const sim = charSimilarity(oldWordStrings[oi]!, newWordStrings[ni]!);
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

  const alloc = createIdAllocator();

  // Inherited IDs are reserved up front: the allocator only avoids collisions
  // with IDs it already knows about, so one inherited later in the build loop
  // would otherwise be handed to an earlier new segment.
  for (let ni = 0; ni < newWordStrings.length; ni++) {
    const oi = newToOldWord.get(ni) ?? morphPairs.get(ni);
    if (oi === undefined) continue;
    const oldGroup = oldWords[oi]!;

    if (!newToOldWord.has(ni) && oldGroup.segments.length === 1) {
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

  // Includes the edges — `segmentText` keeps leading and trailing whitespace on
  // the initial render, so dropping it here would change the value on morph.
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

    if (newToOldWord.has(ni)) {
      const oi = newToOldWord.get(ni)!;
      const oldGroup = oldWords[oi]!;
      for (const seg of oldGroup.segments) segments.push(seg);
    } else if (morphPairs.has(ni)) {
      const oi = morphPairs.get(ni)!;
      const oldGroup = oldWords[oi]!;
      const oldWord = oldGroup.word;
      const newWord = newWordStrings[ni]!;

      let oldCharSegs: Segment[];
      if (oldGroup.segments.length === 1) {
        const wordSeg = oldGroup.segments[0]!;
        oldCharSegs = oldWord.split("").map((c, i) => ({
          id: `${wordSeg.id}:${i}`,
          string: c,
        }));
        splits.set(wordSeg.id, oldCharSegs);
      } else {
        oldCharSegs = oldGroup.segments;
      }

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
    } else {
      segments.push({
        id: alloc.take(newWordStrings[ni]!),
        string: newWordStrings[ni]!,
      });
    }

    charOffset += newWordStrings[ni]!.length;
  }

  pushSeparators(trailingSeparators);

  return { segments, splits };
}
