import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type TrendOptions = {
  /** The flash as the figure rises. */
  up?: string;
  /** The flash as it falls. */
  down?: string;
};

const figure = (text: string) => {
  const digits = text.replace(/[^\d.-]/g, "");
  return digits ? Number(digits) : NaN;
};

/** What changes in a figure flashes green as it rises and red as it falls, then fades back. */
export function trend({
  up = "#4ade80",
  down = "#ff6b6b",
}: TrendOptions = {}): TorphPlugin<string | null> {
  return {
    name: "trend",
    key: `${up}\u0000${down}`,
    read: (_root, _style, { from, to }) => {
      const [a, b] = [figure(from), figure(to)];
      return a === b || Number.isNaN(a) || Number.isNaN(b)
        ? null
        : b > a
          ? up
          : down;
    },
    idle: null,
    // Alongside whatever moves the box, so the numbers' own slide still runs.
    decorate: {
      "*": {
        enter: (box, { state, duration }) =>
          state
            ? [
                box.animate(
                  { color: state, offset: 0 },
                  { duration: duration * 2.5, easing: "ease-in" },
                ),
              ]
            : [],
      },
    },
  };
}
