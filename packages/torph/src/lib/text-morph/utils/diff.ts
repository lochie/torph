import type { Segment } from "./segment";
import {
  createIdAllocator,
  graphemes,
  groupIntoWords,
  segmentText,
} from "./segment";
import { lcsIndices } from "../../utils/lcs";
import { type AnyPlugin, claimant, pluginIds } from "../plugin";
import { CLASSIC } from "../plugins";

export type DiffResult = {
  segments: Segment[];
  splits: Map<string, Segment[]>;
};

export type DiffOptions = {
  /** The plugins that claim and cut words; torph's own set when left out. */
  plugins?: readonly AnyPlugin[];
  /** Caret position, honoured only when the value holds a single claimed word. */
  cursorIndex?: number;
};

/**
 * Per-character segments of an old word, cutting up every piece still longer than
 * one — the character LCS indexes these by character, so a piece left whole would
 * hand its ID, and its element, to whatever character lands on its index.
 */
function splitIntoChars(
  oldGroup: { word: string; segments: Segment[] },
  splits: Map<string, Segment[]>,
): Segment[] {
  return oldGroup.segments.flatMap((seg) => {
    // Cutting a one-character piece mints a new ID for a character that never moved.
    if (seg.string.length <= 1) return [seg];
    const charSegs = seg.string.split("").map((char, i) => ({
      id: `${seg.id}:${i}`,
      string: char,
    }));
    splits.set(seg.id, charSegs);
    return charSegs;
  });
}

/** How a new word gets its segments — the ID pre-pass and the build loop must agree. */
type WordPlan =
  /** `was`: an old word this one matched, but moved too far from to keep. */
  | { mode: "fresh"; was?: number }
  | { mode: "reuse"; oi: number }
  | { mode: "morph"; oi: number }
  | { mode: "plugin"; oi: number; plugin: AnyPlugin };

const same = (char: string) => char;

function charSimilarity(a: string, b: string, fold = same): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [matched] = lcsIndices(a.split("").map(fold), b.split("").map(fold));
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

/** An old word's claim on a new one: the first plugin with an opinion, else shared characters. */
function pairAffinity(
  plugins: readonly AnyPlugin[],
  a: string,
  b: string,
  fold?: (char: string) => string,
): number {
  for (const plugin of plugins) {
    const affinity = plugin.affinity?.(a, b);
    if (affinity != null) return affinity;
  }
  return charSimilarity(a, b, fold);
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
  const newHasSpaces = /[ \u00A0]/.test(newText);
  const newHasNewlines = newText.includes("\n");
  const oldWords = groupIntoWords(oldSegments);

  const plugins = options.plugins ?? CLASSIC;
  const claimOf = (word: string) => claimant(plugins, word, { locale });
  const letters = plugins.some((plugin) => plugin.letters);
  const fold = plugins.find((plugin) => plugin.fold)?.fold;
  const maxShift = Math.min(
    ...plugins.map((plugin) => plugin.maxShift ?? Infinity),
  );
  // NULL-prefixed, so a plugin's token can't equal a real word.
  const token = (word: string) => {
    const plugin = claimOf(word);
    return plugin
      ? `\u0000p${plugin.name}\u0000${plugin.token?.(word) ?? word}`
      : word;
  };

  // Text IDs are derived from the text and survive re-segmentation; minted plugin IDs don't.
  const involved =
    !!fold ||
    plugins.some(
      (plugin) =>
        plugin.claim &&
        (!plugin.touches ||
          plugin.touches(newText) ||
          oldWords.some((g) => plugin.touches!(g.word))),
    );

  if (oldWords.length <= 1 && !newHasSpaces && !newHasNewlines && !involved) {
    return {
      segments: segmentText(newText, locale, plugins),
      splits: new Map(),
    };
  }

  const newWordStrings: string[] = [];
  const newSeparators: string[][] = []; // separators BEFORE each word
  const parts = newText.split(/( |\u00A0|\n)/);
  let pendingSeps: string[] = [];
  for (const part of parts) {
    if (part === " " || part === "\u00A0" || part === "\n") {
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
      segments: segmentText(newText, locale, plugins),
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
        // Claimed and plain words pair freely; MIN_SIMILARITY keeps one off an unrelated word.
        const sim = pairAffinity(
          plugins,
          oldWordStrings[oi]!,
          newWordStrings[ni]!,
          fold,
        );
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
  // Where each word starts, old and new, in characters: how far a kept word would travel.
  const oldStarts: number[] = [];
  let at = 0;
  let inWord = false;
  for (const seg of oldSegments) {
    const separator = seg.string === "\u00A0" || seg.string === "\n";
    if (!separator && !inWord) oldStarts.push(at);
    inWord = !separator;
    at += seg.string.length;
  }
  at = 0;
  const newStarts = newWordStrings.map((word, ni) => {
    at += (newSeparators[ni] ?? (ni > 0 ? [" "] : [])).length;
    const start = at;
    at += word.length;
    return start;
  });

  const plans: WordPlan[] = newWordStrings.map((newWord, ni): WordPlan => {
    const lcsOi = newToOldWord.get(ni);
    const oi = lcsOi ?? morphPairs.get(ni);
    if (oi === undefined) return { mode: "fresh" };
    if (Math.abs(newStarts[ni]! - oldStarts[oi]!) > maxShift) {
      return { mode: "fresh", was: oi };
    }
    const plugin = claimOf(newWord);
    if (plugin) return { mode: "plugin", oi, plugin };
    return lcsOi !== undefined ? { mode: "reuse", oi } : { mode: "morph", oi };
  });

  // Meaningless once a value holds several figures.
  const cursorIndex =
    plans.filter((plan) => plan.mode === "plugin").length === 1
      ? options.cursorIndex
      : undefined;

  const alloc = createIdAllocator();

  // Reserved up front: an ID inherited later would otherwise go to an earlier segment.
  for (const plan of plans) {
    if (plan.mode === "fresh") {
      // The old word is leaving, so the new one must not take its boxes.
      if (plan.was !== undefined) {
        for (const seg of oldWords[plan.was]!.segments) alloc.reserve(seg.id);
      }
      continue;
    }
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
    } else if (plan.mode === "plugin") {
      const oldGroup = oldWords[plan.oi]!;

      segments.push(
        ...plan.plugin.segment!(newWord, {
          locale,
          previous: oldGroup.segments,
          split: () => splitIntoChars(oldGroup, splits),
          cursor:
            cursorIndex === undefined ? undefined : cursorIndex - charOffset,
          id: pluginIds(plan.plugin, alloc),
        }),
      );
    } else if (plan.mode === "morph") {
      const oldGroup = oldWords[plan.oi]!;
      const oldWord = oldGroup.word;
      const oldCharSegs = splitIntoChars(oldGroup, splits);

      const oldChars = oldWord.split("");
      const newChars = newWord.split("");
      const [oldCharLcs, newCharLcs] = lcsIndices(
        oldChars.map(fold ?? same),
        newChars.map(fold ?? same),
      );

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
    } else if (claimOf(newWord)) {
      const plugin = claimOf(newWord)!;
      segments.push(
        ...plugin.segment!(newWord, {
          locale,
          split: () => [],
          id: pluginIds(plugin, alloc),
        }),
      );
    } else {
      if (letters) {
        graphemes(newWord, locale).forEach((char, ci) =>
          segments.push({ id: alloc.take(`${newWord}~${ci}`), string: char }),
        );
      } else {
        segments.push({ id: alloc.take(newWord), string: newWord });
      }
    }

    charOffset += newWord.length;
  }

  pushSeparators(trailingSeparators);

  return { segments, splits };
}
