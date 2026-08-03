export type Segment = {
  id: string;
  string: string;
};

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

export function segmentText(
  value: string,
  locale: Intl.LocalesArgument,
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

    return allSegments;
  }

  return segmentLine(value, locale, byWord, 0, alloc);
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
