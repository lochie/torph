import type { TorphPlugin } from "../../lib/text-morph/plugin";

// Material's emphasised decelerate: quick to arrive, slow to settle.
const SETTLE = "cubic-bezier(0.2, 0, 0, 1)";
// The share of the duration old text has to fade before new text starts.
const OUT = 0.35;

/** Old text fades out completely, then new text fades in, growing slightly into place: Material's fade through. */
export function fadeThrough(): TorphPlugin {
  return {
    name: "fadeThrough",
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, animate }) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, ${delta.y + (from?.ty ?? 0)}px) scale(0.92)`,
                opacity: 0,
              },
              { transform: "none", opacity: 1 },
            ],
            {
              duration: duration * (1 - OUT),
              delay: duration * OUT,
              easing: SETTLE,
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
            { duration: duration * OUT, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
