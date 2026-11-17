import type { Segment, TorphPlugin } from "../../lib/text-morph/plugin";

/** Longest common subsequence of two lists, as index pairs in order. */
function common<T>(a: T[], b: T[]): [number, number][] {
  const dp = a.map(() => new Array<number>(b.length + 1).fill(0));
  dp.push(new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  return pairs;
}

/** A line's words and spaces, as the engine draws them. */
const pieces = (line: string) =>
  line
    .split(/( )/)
    .filter(Boolean)
    .map((piece) => (piece === " " ? "\u00A0" : piece));

/**
 * A value cut line by line, the way a code diff reads: an unchanged line keeps its boxes,
 * a changed one keeps the words it shares with the line it replaced, and a line with
 * nothing in its place is all new, or all removed.
 */
function byLine(value: string, previous: Segment[], id: () => string) {
  // The old lines' pieces, each line with the break that ends it.
  const old: { pieces: Segment[]; end?: Segment }[] = [{ pieces: [] }];
  for (const segment of previous) {
    if (segment.string === "\n") {
      old.at(-1)!.end = segment;
      old.push({ pieces: [] });
    } else old.at(-1)!.pieces.push(segment);
  }
  const text = (line: { pieces: Segment[] }) =>
    line.pieces.map((p) => p.string).join("");
  const lines = value.split("\n").map(pieces);
  const kept = common(
    old.map(text),
    lines.map((l) => l.join("")),
  );

  // Each new line's old counterpart: the same line, or the one in the same gap between kept lines.
  const partner = new Map<number, number>(kept.map(([o, n]) => [n, o]));
  const anchors: [number, number][] = [
    [-1, -1],
    ...kept,
    [old.length, lines.length],
  ];
  for (let k = 1; k < anchors.length; k++) {
    const [o0, n0] = anchors[k - 1]!;
    const [o1, n1] = anchors[k]!;
    for (let i = 1; n0 + i < n1 && o0 + i < o1; i++)
      partner.set(n0 + i, o0 + i);
  }

  return lines.flatMap((line, n) => {
    const was = partner.get(n);
    const pool = was === undefined ? [] : [...old[was]!.pieces];
    const cut: Segment[] = line.map((string) => {
      // The next old piece with the same text keeps its box, in order.
      const at = pool.findIndex((p) => p.string === string);
      const keep = at >= 0 ? pool.splice(0, at + 1).at(-1) : undefined;
      return { id: keep?.id ?? id(), string };
    });
    if (n < lines.length - 1) {
      cut.push({
        id: (was !== undefined && old[was]!.end?.id) || id(),
        string: "\n",
      });
    }
    return cut;
  });
}

export type RedlineOptions = {
  /** How long removed text stays struck through in the line, as a multiple of the duration. */
  linger?: number;
  /** The colour of removed text and its strike. */
  removed?: string;
  /** The colour of added text and its underline. */
  added?: string;
};

/** Like track changes: removed words stay struck through before they go, added words come underlined. */
export function redline({
  linger = 2,
  removed = "#ff6b6b",
  added = "#6bdc8b",
}: RedlineOptions = {}): TorphPlugin {
  // A line drawn as a background, so it sweeps in along the word.
  const rule = (color: string, at: string) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `0 ${at}`,
  });
  const strike = rule(removed, "55%");
  const underline = rule(added, "100%");

  return {
    name: "redline",
    key: `${linger}\u0000${removed}\u0000${added}`,
    linger,
    // A whole removed line is a replaced run; kept from group replacement, it strikes through like any other.
    runs: { claim: () => true },
    // Several lines are diffed a line at a time, like code; a single line word by word.
    whole: (value, { previous, id }) =>
      value.includes("\n") || previous.some((s) => s.string === "\n")
        ? byLine(value, previous, () => id())
        : null,
    // Whole words, as an editor's changes read.
    claim: () => true,
    segment: (word, { id }) => [{ id: id(word), string: word }],
    animate: {
      text: {
        // Struck through as it lingers, then gone as the line closes up.
        exit: (box, { duration }) => {
          const total = duration * (linger + 0.4);
          // Spaces and breaks still hold the line's shape while they linger, unmarked.
          if (!box.textContent?.trim()) return [];
          return [
            box.animate(
              [
                { ...strike, backgroundSize: "0% 0.08em" },
                {
                  ...strike,
                  backgroundSize: "100% 0.08em",
                  color: removed,
                  offset: (duration * 0.4) / total,
                },
                {
                  ...strike,
                  backgroundSize: "100% 0.08em",
                  color: removed,
                  opacity: 1,
                  offset: (duration * linger) / total,
                },
                {
                  ...strike,
                  backgroundSize: "100% 0.08em",
                  color: removed,
                  opacity: 0,
                },
              ],
              { duration: total, fill: "both" },
            ),
          ];
        },
        // Underlined as it arrives, the mark fading back to plain text.
        enter: (box, { duration }) =>
          !box.textContent?.trim()
            ? []
            : [
                box.animate(
                  [
                    {
                      ...underline,
                      backgroundSize: "0% 0.08em",
                      color: added,
                      opacity: 0,
                    },
                    {
                      ...underline,
                      backgroundSize: "100% 0.08em",
                      color: added,
                      opacity: 1,
                      offset: 0.2,
                    },
                    {
                      ...underline,
                      backgroundSize: "100% 0.08em",
                      color: added,
                      offset: 0.7,
                    },
                    { ...underline, backgroundSize: "100% 0em" },
                  ],
                  { duration: duration * (linger + 1), fill: "backwards" },
                ),
              ],
      },
    },
  };
}
