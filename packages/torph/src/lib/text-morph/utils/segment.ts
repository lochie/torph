export type { Segment } from "../../utils/types";
import type { Segment } from "../../utils/types";
import { type ContentPart, formatKey, plainText } from "./content";
import { isNumericWord, segmentNumber } from "./number";

// A collision makes two segments fight over one element and one silently loses its
// text, so uniqueness has to hold across the whole value, not per line.
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

/** Whitespace-delimited words — the unit the diff aligns on, and so a number's bounds. */
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

  let key = "";
  for (const seg of segments) {
    if (seg.string === "\u00A0" || seg.string === "\n") flush();
    else if (seg.node) {
      flush();
      groups.push({ word: seg.string, segments: [seg] });
    } else {
      if (formatKey(seg.format) !== key) flush();
      key = formatKey(seg.format);
      current.push(seg);
    }
  }
  flush();

  return groups;
}

/**
 * Re-cuts every numeric word into per-character segments carrying a kind. A pass over
 * the finished segmentation, not part of it: `Intl.Segmenter` splits "$1,234" on its
 * own terms, and regrouping on whitespace is what keeps this and the diff agreeing.
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
    if (seg.string === "\u00A0" || seg.string === "\n" || seg.node) {
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
  return segmentContent([{ kind: "text", value }], locale, numbers);
}

export function segmentContent(
  parts: ContentPart[],
  locale: Intl.LocalesArgument,
  numbers = true,
): Segment[] {
  const text = plainText(parts);
  // An element is a word boundary, so any value holding one is segmented by word.
  const byWord =
    text.includes(" ") ||
    text.includes("\n") ||
    parts.some((part) => part.kind === "element");
  const alloc = createIdAllocator();

  const segments: Segment[] = [];
  // `offset` indexes the whole value, so IDs derived from it stay unique across parts.
  let offset = 0;

  for (const part of parts) {
    if (part.kind === "element") {
      segments.push({ id: part.id, string: part.id, node: part.node });
      offset += 1;
      continue;
    }

    part.value.split("\n").forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        segments.push({ id: alloc.take(`newline-${offset}`), string: "\n" });
        offset += 1;
      }
      if (line.length > 0) {
        // Spaces included: a part is one run, so a space inside it is interior to
        // that run — and a decoration drawn on it would otherwise break at every gap.
        for (const seg of segmentLine(line, locale, byWord, offset, alloc)) {
          if (part.format) seg.format = part.format;
          segments.push(seg);
        }
      }
      offset += line.length;
    });
  }

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
