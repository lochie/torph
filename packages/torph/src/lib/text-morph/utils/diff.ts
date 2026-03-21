import type { Segment } from "./segment";
import { segmentText } from "./segment";

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

function lcsIndices(a: string[], b: string[]): [number[], number[]] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const ai: number[] = [];
  const bi: number[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ai.unshift(i - 1);
      bi.unshift(j - 1);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
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

  // Split new text into words and track separators (space vs newline)
  const newWordStrings: string[] = [];
  const newSeparators: string[][] = []; // separators BEFORE each word (index 0 is empty)
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

  const oldWordStrings = oldWords.map((g) => g.word);

  // Word-level LCS
  const [oldLcsIdx, newLcsIdx] = lcsIndices(oldWordStrings, newWordStrings);
  const oldMatchedSet = new Set(oldLcsIdx);
  const newMatchedSet = new Set(newLcsIdx);

  const newToOldWord = new Map<number, number>();
  for (let k = 0; k < newLcsIdx.length; k++) {
    newToOldWord.set(newLcsIdx[k]!, oldLcsIdx[k]!);
  }

  // Pair unmatched words by similarity
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

  const usedIds = new Set<string>();
  function uniqueId(base: string): string {
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let i = 1;
    while (usedIds.has(`${base}~${i}`)) i++;
    const id = `${base}~${i}`;
    usedIds.add(id);
    return id;
  }

  const segments: Segment[] = [];
  const splits = new Map<string, Segment[]>();
  let charOffset = 0;

  for (let ni = 0; ni < newWordStrings.length; ni++) {
    if (ni > 0) {
      const seps = newSeparators[ni] || [" "];
      for (const sep of seps) {
        if (sep === "\n") {
          segments.push({
            id: `newline-${charOffset}`,
            string: "\n",
          });
        } else {
          segments.push({
            id: `space-${charOffset}`,
            string: "\u00A0",
          });
        }
        charOffset++;
      }
    }

    if (newToOldWord.has(ni)) {
      // Exact word match — reuse old segments
      const oi = newToOldWord.get(ni)!;
      const oldGroup = oldWords[oi]!;
      for (const seg of oldGroup.segments) {
        usedIds.add(seg.id);
        segments.push(seg);
      }
    } else if (morphPairs.has(ni)) {
      // Character morph between similar words
      const oi = morphPairs.get(ni)!;
      const oldGroup = oldWords[oi]!;
      const oldWord = oldGroup.word;
      const newWord = newWordStrings[ni]!;

      // Get or create old char segments
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

      // Character-level LCS
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
          usedIds.add(oldSeg.id);
          segments.push({ id: oldSeg.id, string: newChars[ci]! });
        } else {
          segments.push({
            id: uniqueId(`${newWord}~${ci}`),
            string: newChars[ci]!,
          });
        }
      }
    } else {
      // No match — new word enters
      segments.push({
        id: uniqueId(newWordStrings[ni]!),
        string: newWordStrings[ni]!,
      });
    }

    charOffset += newWordStrings[ni]!.length;
  }

  return { segments, splits };
}
