export type { Segment } from "../../utils/types";
import type { Segment } from "../../utils/types";
import { isNumericWord, segmentNumber } from "./number";

// IDs are the identity used for FLIP tracking and DOM reconciliation, so a
// collision makes two segments fight over one element and one of them silently
// loses its text. Uniqueness has to hold across the whole value, not per line.
export function createIdAllocator() {
  const used = new Set<string>();

  return {
    reserve(id: string) {
      used.add(id);
    },
    has(id: string) {
      return used.has(id);
    },
    take(base: string): string {
      if (!used.has(base)) {
        used.add(base);
        return base;
      }
      let i = 1;
      while (used.has(`${base}~${i}`)) i++;
      const id = `${base}~${i}`;
      used.add(id);
      return id;
    },
  };
}

export type IdAllocator = ReturnType<typeof createIdAllocator>;

/**
 * Splits segments into whitespace-delimited words, the unit the word-level diff
 * aligns on. A number is whatever one of those words turns out to be, so this is
 * also what decides where a number starts and ends.
 */
export function groupIntoWords(segments: Segment[]): {
  word: string;
  segments: Segment[];
}[] {
  const groups: { word: string; segments: Segment[] }[] = [];
  let current: Segment[] = [];

  const flush = () => {
    if (current.length === 0) return;
    groups.push({
      word: current.map((s) => s.string).join(""),
      segments: current,
    });
    current = [];
  };

  for (const seg of segments) {
    if (seg.string === "\u00A0" || seg.string === "\n") flush();
    else current.push(seg);
  }
  flush();

  return groups;
}

/**
 * Re-cuts every numeric word into per-character segments carrying a kind.
 *
 * Run as a pass over the finished segmentation rather than inside it: word
 * segmentation is `Intl.Segmenter`'s job and it splits a token like "$1,234"
 * on its own terms, which is the wrong shape for place matching. Regrouping
 * afterwards on whitespace is what keeps this pass and the diff agreeing on
 * where a number begins.
 *
 * The IDs abandoned here stay reserved in the allocator. That costs nothing —
 * they are only ever checked for collisions — and the alternative is deciding
 * what is a number before knowing where the words are.
 */
function expandNumbers(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  let run: Segment[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const word = run.map((s) => s.string).join("");
    if (isNumericWord(word)) out.push(...segmentNumber(word));
    else out.push(...run);
    run = [];
  };

  for (const seg of segments) {
    if (seg.string === "\u00A0" || seg.string === "\n") {
      flush();
      out.push(seg);
    } else {
      run.push(seg);
    }
  }
  flush();

  return out;
}

export function segmentText(
  value: string,
  locale: Intl.LocalesArgument,
  numbers = true,
): Segment[] {
  const hasNewlines = value.includes("\n");
  const byWord = value.includes(" ") || hasNewlines;
  const alloc = createIdAllocator();

  if (hasNewlines) {
    // `offset` is the character index into the full value, so IDs derived from
    // it stay unique across lines.
    const lines = value.split("\n");
    const allSegments: Segment[] = [];
    let offset = 0;

    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        allSegments.push({
          id: alloc.take(`newline-${offset}`),
          string: "\n",
        });
        offset += 1;
      }
      if (line.length > 0) {
        allSegments.push(...segmentLine(line, locale, true, offset, alloc));
      }
      offset += line.length;
    });

    return numbers ? expandNumbers(allSegments) : allSegments;
  }

  const segments = segmentLine(value, locale, byWord, 0, alloc);
  return numbers ? expandNumbers(segments) : segments;
}

function segmentLine(
  line: string,
  locale: Intl.LocalesArgument,
  byWord: boolean,
  offset: number,
  alloc: IdAllocator,
): Segment[] {
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: byWord ? "word" : "grapheme",
    });
    return segmentsFromIntl(
      segmenter.segment(line)[Symbol.iterator](),
      offset,
      alloc,
    );
  }

  return segmentsFallback(line, byWord, offset, alloc);
}

function segmentsFromIntl(
  iterator: Intl.SegmentIterator<Intl.SegmentData>,
  offset: number,
  alloc: IdAllocator,
): Segment[] {
  const segments: Segment[] = [];

  for (const data of Array.from(iterator)) {
    const index = offset + data.index;
    if (data.segment === " ") {
      segments.push({ id: alloc.take(`space-${index}`), string: "\u00A0" });
    } else {
      segments.push({
        id: allocSegmentId(data.segment, index, alloc),
        string: data.segment,
      });
    }
  }

  return segments;
}

function allocSegmentId(
  part: string,
  index: number,
  alloc: IdAllocator,
): string {
  return alloc.has(part) ? alloc.take(`${part}-${index}`) : alloc.take(part);
}

function segmentsFallback(
  value: string,
  byWord: boolean,
  offset: number,
  alloc: IdAllocator,
): Segment[] {
  const parts = byWord ? value.split(" ") : value.split("");
  const segments: Segment[] = [];
  let index = offset;

  parts.forEach((part, i) => {
    if (byWord && i > 0) {
      segments.push({ id: alloc.take(`space-${index}`), string: "\u00A0" });
      index += 1;
    }
    segments.push({ id: allocSegmentId(part, index, alloc), string: part });
    index += part.length;
  });

  return segments;
}
