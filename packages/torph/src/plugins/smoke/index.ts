import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SmokeOptions = {
  /** How far leaving text rises before it's gone, in em. */
  rise?: number;
};

// Each letter's drift, by its place: uneven, so the wisps don't move as one.
const DRIFT = [-0.5, 0.35, -0.2, 0.6, -0.4, 0.15, 0.5, -0.3];

/** Leaving text curls up and away like smoke, a letter at a time; new text condenses out of the haze. */
export function smoke({ rise = 1.4 }: SmokeOptions = {}): TorphPlugin {
  return {
    name: "smoke",
    key: `${rise}`,
    letters: true,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        // Out of a haze, slowly, after the old text has started to drift.
        enter: (box, { delta, from, duration, index, arriving, animate }) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, calc(${delta.y + (from?.ty ?? 0)}px + 0.15em)) scale(1.15)`,
                filter: "blur(0.25em)",
                opacity: 0,
              },
              { filter: "blur(0.08em)", opacity: 0.6, offset: 0.5 },
              { transform: "none", filter: "blur(0em)", opacity: 1 },
            ],
            {
              duration: duration * 1.2,
              delay:
                duration * 0.15 +
                (index / Math.max(1, arriving)) * duration * 0.25,
              easing: "ease-out",
              fill: "backwards",
            },
          ),
        ],
        // Each letter its own wisp: up, curling sideways, swelling and thinning to nothing.
        exit: (box, { delta, duration, index, leaving, animate }) => {
          const drift = DRIFT[index % DRIFT.length]!;
          return [
            animate(
              box,
              [
                { filter: "blur(0em)", opacity: 1 },
                {
                  transform: `translate(calc(${delta.x}px + ${drift * 0.3}em), calc(${delta.y}px - ${rise * 0.35}em)) rotate(${drift * 15}deg) scale(1.1)`,
                  filter: "blur(0.06em)",
                  opacity: 0.8,
                  offset: 0.3,
                },
                {
                  transform: `translate(calc(${delta.x}px + ${drift}em), calc(${delta.y}px - ${rise}em)) rotate(${drift * 50}deg) skewX(${drift * -25}deg) scale(1.7)`,
                  filter: "blur(0.3em)",
                  opacity: 0,
                },
              ],
              {
                duration: duration * 1.3,
                delay: (index / Math.max(1, leaving)) * duration * 0.25,
                easing: "cubic-bezier(0.3, 0.2, 0.4, 1)",
                fill: "both",
              },
            ),
          ];
        },
      },
    },
  };
}
