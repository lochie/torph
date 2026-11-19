import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type NeonOptions = {
  /** The glow; by default, the text's own colour. */
  color?: string;
};

// A tube catching: off, a stutter, a hold, off again, then on for good.
const CATCH = [0, 0.7, 0.1, 0.9, 0.9, 0.2, 1];

/** New text flickers on like a neon tube warming up, glowing as it does; leaving text buzzes off. */
export function neon({
  color = "currentColor",
}: NeonOptions = {}): TorphPlugin {
  const glow = (strength: number) =>
    strength > 0
      ? `0 0 ${0.1 * strength}em ${color}, 0 0 ${0.4 * strength}em ${color}`
      : "none";
  return {
    name: "neon",
    key: color,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, index, animate }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          return [
            animate(
              box,
              [
                ...CATCH.map((opacity) => ({
                  opacity,
                  textShadow: glow(opacity),
                  easing: "steps(1, end)",
                })),
                { opacity: 1, textShadow: glow(0) },
              ],
              {
                duration: duration * 1.6,
                // A little out of step with its neighbours, as separate tubes would be.
                delay: (index % 3) * duration * 0.08,
                fill: "backwards",
              },
            ),
            ...(x || y
              ? [
                  animate(
                    box,
                    [
                      { transform: `translate(${x}px, ${y}px)` },
                      { transform: "none" },
                    ],
                    { duration, easing: "ease-out", fill: "backwards" },
                  ),
                ]
              : []),
          ];
        },
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            [
              { opacity: 1, textShadow: glow(1), easing: "steps(1, end)" },
              { opacity: 0.3, textShadow: glow(0.3), easing: "steps(1, end)" },
              { opacity: 0.8, textShadow: glow(0.8) },
              {
                opacity: 0,
                textShadow: glow(0),
                transform: `translate(${delta.x}px, ${delta.y}px)`,
              },
            ],
            { duration: duration * 0.5, fill: "both" },
          ),
        ],
      },
    },
  };
}
