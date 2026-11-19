import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { idlePlace, placeOf, readPlace, type Place } from "../place";

export type RippleOptions = {
  /** The most each letter waits after the one nearer the change, as a share of the duration. */
  spread?: number;
};

/** New letters pop in outward from where the text changed, like a stone dropped in water. */
export function ripple({
  spread = 0.06,
}: RippleOptions = {}): TorphPlugin<Place> {
  return {
    name: "ripple",
    key: `${spread}`,
    letters: true,
    read: (_root, _style, { from, to }) => readPlace(from, to),
    idle: idlePlace(),
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, ease, state, animate }) => {
          const far = Math.max(1, state.start, state.length - state.start);
          // However long the text, the last ring starts within half the duration.
          const step = Math.min(spread, 0.5 / far) * duration;
          return [
            animate(
              box,
              [
                {
                  transform: `translate(${delta.x + (from?.tx ?? 0)}px, ${delta.y + (from?.ty ?? 0)}px) scale(0.4)`,
                  opacity: 0,
                },
                { transform: "none", opacity: 1 },
              ],
              {
                duration,
                delay: Math.abs(placeOf(box, state) - state.start) * step,
                easing: ease,
                fill: "backwards",
              },
            ),
          ];
        },
        // All at once: what's leaving clears the way for the ripple.
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            {
              transform: `translate(${delta.x}px, ${delta.y}px) scale(0.6)`,
              opacity: 0,
              offset: 1,
            },
            { duration: duration * 0.35, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
