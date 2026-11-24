import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type GlitchOptions = {
  /** The two colours the channels split into. */
  colors?: [string, string];
  /** How many cuts the glitch makes before the text settles. */
  cuts?: number;
};

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** The change comes through a short digital glitch, different every time: sliced bands, split colour, then a clean snap. */
export function glitch({
  colors = ["#ff2a6d", "#05d9e8"],
  cuts = 7,
}: GlitchOptions = {}): TorphPlugin {
  const [a, b] = colors;
  /** A fresh run of cuts, each a random band, shove and split; the last always clean. */
  const frames = (x: number, y: number, leaving: boolean) =>
    Array.from({ length: cuts + 1 }, (_, i) => {
      const last = i === cuts;
      const left = 1 - i / cuts;
      if (last)
        return {
          clipPath: "inset(0% 0% 0% 0%)",
          transform: leaving ? `translate(${x}px, ${y}px)` : "none",
          textShadow: `0em 0 ${a}, 0em 0 ${b}`,
          opacity: leaving ? 0 : 1,
        };
      const top = random(0, 70);
      const split = random(0.03, 0.09) * left;
      return {
        clipPath: `inset(${top}% 0% ${random(0, 90 - top)}% 0%)`,
        transform: `translate(calc(${leaving ? x * (1 - left) : x * left}px + ${random(-0.12, 0.12) * left}em), ${leaving ? y * (1 - left) : y * left}px) skewX(${random(-12, 12) * left}deg)`,
        textShadow: `${split}em 0 ${a}, ${-split}em 0 ${b}`,
        opacity: leaving && Math.random() < 0.3 ? 0.4 : 1,
        // A hard cut between frames: a glitch doesn't ease.
        easing: "steps(1, end)",
      };
    });
  return {
    name: "glitch",
    key: `${colors.join("\u0000")}\u0000${cuts}`,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, animate }) => [
          animate(
            box,
            frames(delta.x + (from?.tx ?? 0), delta.y + (from?.ty ?? 0), false),
            { duration: duration * 0.8, fill: "backwards" },
          ),
        ],
        exit: (box, { delta, duration, animate }) => [
          animate(box, frames(delta.x, delta.y, true), {
            duration: duration * 0.45,
            fill: "both",
          }),
        ],
      },
    },
  };
}
