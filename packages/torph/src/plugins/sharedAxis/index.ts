import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { went } from "../went";

export type SharedAxisOptions = {
  /** Along the line, up and down, or towards and away. */
  axis?: "x" | "y" | "z";
  /** Which way it goes. `"auto"` goes forward for a higher figure and back for a lower one: "Step 3 of 5". */
  direction?: "forward" | "back" | "auto";
  /** How far text travels, as a CSS length. */
  distance?: string;
};

type State = { back: boolean };

const SETTLE = "cubic-bezier(0.2, 0, 0, 1)";
const OUT = 0.3;

/** Material's shared axis: old text leaves one way as new text arrives from the other, along x, y or z. */
export function sharedAxis({
  axis = "x",
  direction = "auto",
  distance = "0.8em",
}: SharedAxisOptions = {}): TorphPlugin<State> {
  /** Where text is `toward` one side: +1 is where new text comes from going forward. */
  const away = (toward: number) =>
    axis === "z"
      ? `scale(${toward > 0 ? 0.85 : 1.15})`
      : axis === "x"
        ? `translateX(calc(${distance} * ${toward}))`
        : `translateY(calc(${distance} * ${toward}))`;
  return {
    name: "sharedAxis",
    key: `${axis}\u0000${direction}\u0000${distance}`,
    read: (_root, _style, change) => ({
      back:
        direction === "back" ||
        (direction === "auto" && went(change.from, change.to) === "down"),
    }),
    idle: { back: direction === "back" },
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, state, animate }) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, ${delta.y + (from?.ty ?? 0)}px) ${away(state.back ? -1 : 1)}`,
                opacity: 0,
              },
              { transform: "none", opacity: 1 },
            ],
            {
              duration: duration * (1 - OUT),
              delay: duration * OUT * 0.8,
              easing: SETTLE,
              fill: "backwards",
            },
          ),
        ],
        exit: (box, { delta, duration, state, animate }) => [
          animate(
            box,
            {
              transform: `translate(${delta.x}px, ${delta.y}px) ${away(state.back ? 1 : -1)}`,
              opacity: 0,
              offset: 1,
            },
            { duration: duration * OUT, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
