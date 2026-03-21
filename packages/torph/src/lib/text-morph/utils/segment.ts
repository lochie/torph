export type Segment = {
  id: string;
  string: string;
};

export function segmentText(
  value: string,
  locale: Intl.LocalesArgument,
): Segment[] {
  const hasNewlines = value.includes("\n");
  const byWord = value.includes(" ") || hasNewlines;

  if (hasNewlines) {
    // Split by newlines, segment each line at word level, join with newline segments
    const lines = value.split("\n");
    const allSegments: Segment[] = [];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        allSegments.push({ id: `newline-${lineIndex}`, string: "\n" });
      }
      if (line.length === 0) return;
      let lineSegments: Segment[];
      if (typeof Intl.Segmenter !== "undefined") {
        const segmenter = new Intl.Segmenter(locale, {
          granularity: "word",
        });
        lineSegments = segmentsFromIntl(segmenter.segment(line)[Symbol.iterator]());
      } else {
        lineSegments = segmentsFallback(line, true);
      }
      allSegments.push(...lineSegments);
    });
    return allSegments;
  }

  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: byWord ? "word" : "grapheme",
    });
    const iterator = segmenter.segment(value)[Symbol.iterator]();
    return segmentsFromIntl(iterator);
  }

  return segmentsFallback(value, byWord);
}

function segmentsFromIntl(
  iterator: Intl.SegmentIterator<Intl.SegmentData>,
): Segment[] {
  return Array.from(iterator).reduce((acc, data) => {
    if (data.segment === " ") {
      return [...acc, { id: `space-${data.index}`, string: "\u00A0" }];
    }

    const existing = acc.find((x) => x.string === data.segment);
    if (existing) {
      return [
        ...acc,
        { id: `${data.segment}-${data.index}`, string: data.segment },
      ];
    }

    return [
      ...acc,
      {
        id: data.segment,
        string: data.segment,
      },
    ];
  }, [] as Segment[]);
}

function pushSegment(segments: Segment[], part: string, index: number) {
  const existing = segments.find((x) => x.string === part);
  segments.push(
    existing
      ? { id: `${part}-${index}`, string: part }
      : { id: part, string: part },
  );
}

function segmentsFallback(value: string, byWord: boolean): Segment[] {
  const parts = byWord ? value.split(" ") : value.split("");
  const segments: Segment[] = [];

  parts.forEach((part, index) => {
    if (byWord && index > 0) {
      segments.push({ id: `space-${index}`, string: "\u00A0" });
    }
    pushSegment(segments, part, index);
  });

  return segments;
}
