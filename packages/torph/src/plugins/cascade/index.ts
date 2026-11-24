import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { lineOf, type Lines } from "../line";

export type CascadeOptions = {
  /** Each line's start after the one above, as a share of the duration. */
  step?: number;
  /** How far new text rises as it fades in, as a CSS length. */
  distance?: string;
};

/** Text arrives a line at a time, top to bottom, the way a heading sequence reads in. */
export function cascade({
  step = 0.15,
  distance = "0.35em",
}: CascadeOptions = {}): TorphPlugin<Lines> {
  return {
    name: "cascade",
    key: `${step}\u0000${distance}`,
    read: () => ({ lines: null }),
    idle: { lines: null },
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, ease, state, animate }) => [
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
              delay: lineOf(box, state) * step * duration,
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
