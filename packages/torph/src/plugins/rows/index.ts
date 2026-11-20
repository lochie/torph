import type { Segment, TorphPlugin } from "../../lib/text-morph/plugin";

export type RowsOptions = {
  /** What a line is known by from one value to the next: the whole line, by default. */
  key?: (line: string) => string;
};

/** Each line is one box, known by its key, so a reordered list slides every row to its new place. */
export function rows({ key = (line) => line }: RowsOptions = {}): TorphPlugin {
  return {
    name: "rows",
    whole: (value, { previous, id }) => {
      // Last value's rows by key, so a row keeps its box wherever it lands.
      const was = new Map(
        previous
          .filter((segment) => segment.kind === "row")
          .map((segment) => [key(segment.string), segment.id]),
      );
      const breaks = previous.filter((segment) => segment.string === "\n");
      return value.split("\n").flatMap((line, i): Segment[] => {
        const kept = was.get(key(line));
        // Taken once: a second line with the same key is a new row.
        was.delete(key(line));
        return [
          ...(i > 0 ? [{ id: breaks[i - 1]?.id ?? id(), string: "\n" }] : []),
          { id: kept ?? id(), string: line, kind: "row" },
        ];
      });
    },
    css: `[torph-kind="row"] { white-space: pre; }`,
    kinds: {
      row: {
        // A row that changed while it moved settles on its new text with a blink.
        persist: (
          box,
          { delta, from, was, mover, duration, ease, animate },
        ) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          return [
            animate(
              box,
              [
                { transform: `translate(${x}px, ${y}px)` },
                { transform: "none" },
              ],
              { duration, easing: ease, fill: "backwards" },
            ),
            ...(was !== undefined && was !== mover.textContent
              ? [
                  animate(mover, [{ opacity: 0.35 }, { opacity: 1 }], {
                    duration: duration / 2,
                    delay: duration / 2,
                    fill: "backwards",
                  }),
                ]
              : []),
          ];
        },
      },
    },
  };
}
