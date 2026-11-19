import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type FadeUpOptions = {
  /** How far new text rises as it fades in, as a CSS length. */
  distance?: string;
  /** Each box's start after the one before, as a share of the duration. */
  stagger?: number;
};

/** New text fades up into place, one after another; old text fades out, all at once. */
export function fadeUp({
  distance = "0.35em",
  stagger = 0.04,
}: FadeUpOptions = {}): TorphPlugin {
  // However many boxes, the last starts within a third of the duration.
  const delay = (index: number, count: number, duration: number) =>
    index * Math.min(stagger, 1 / 3 / Math.max(1, count - 1)) * duration;
  return {
    name: "fadeUp",
    key: `${distance}\u0000${stagger}`,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (
          box,
          { delta, from, duration, ease, index, arriving, animate },
        ) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, calc(${delta.y + (from?.ty ?? 0)}px + ${distance}))`,
                opacity: 0,
              },
              { transform: "none", opacity: 1 },
            ],
            {
              duration,
              delay: delay(index, arriving, duration),
              easing: ease,
              fill: "backwards",
            },
          ),
        ],
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            {
              transform: `translate(${delta.x}px, ${delta.y}px)`,
              opacity: 0,
              offset: 1,
            },
            { duration: duration * 0.4, easing: "ease-out", fill: "both" },
          ),
        ],
      },
    },
  };
}
