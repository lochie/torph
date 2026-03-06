export type Block = {
  id: string;
  string: string;
};

export function segmentText(
  value: string,
  locale: Intl.LocalesArgument,
): Block[] {
  const byWord = value.includes(" ");

  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: byWord ? "word" : "grapheme",
    });
    const iterator = segmenter.segment(value)[Symbol.iterator]();
    return blocksFromSegmenter(iterator);
  }

  return blocksFallback(value, byWord);
}

function blocksFromSegmenter(
  iterator: Intl.SegmentIterator<Intl.SegmentData>,
): Block[] {
  return Array.from(iterator).reduce((acc, string) => {
    if (string.segment === " ") {
      return [...acc, { id: `space-${string.index}`, string: "\u00A0" }];
    }

    const existingString = acc.find((x) => x.string === string.segment);
    if (existingString) {
      return [
        ...acc,
        { id: `${string.segment}-${string.index}`, string: string.segment },
      ];
    }

    return [
      ...acc,
      {
        id: string.segment,
        string: string.segment,
      },
    ];
  }, [] as Block[]);
}

function pushBlock(blocks: Block[], segment: string, index: number) {
  const existing = blocks.find((x) => x.string === segment);
  blocks.push(
    existing
      ? { id: `${segment}-${index}`, string: segment }
      : { id: segment, string: segment },
  );
}

function blocksFallback(value: string, byWord: boolean): Block[] {
  const segments = byWord ? value.split(" ") : value.split("");
  const blocks: Block[] = [];

  segments.forEach((segment, index) => {
    if (byWord && index > 0) {
      blocks.push({ id: `space-${index}`, string: "\u00A0" });
    }
    pushBlock(blocks, segment, index);
  });

  return blocks;
}
