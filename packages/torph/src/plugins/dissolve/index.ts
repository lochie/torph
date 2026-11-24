import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type DissolveOptions = {
  /** How far apart the dots are at their sparsest, in em. */
  grain?: number;
};

// Dots this far apart overlap, so the screen covers the whole letter.
const SOLID = 0.07;
const DOT = "radial-gradient(circle, #000 0.05em, transparent 0.065em)";

/** Letters break into a screen of dots that thins away, and gather from one as they arrive. */
export function dissolve({ grain = 0.3 }: DissolveOptions = {}): TorphPlugin {
  const screen = (size: number) => ({
    maskImage: DOT,
    maskSize: `${size}em ${size}em`,
  });
  return {
    name: "dissolve",
    key: `${grain}`,
    letters: true,
    // Every replaced run, so groups() can't move it as one shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, animate }) => [
          animate(
            box,
            [
              {
                ...screen(grain),
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, ${delta.y + (from?.ty ?? 0)}px)`,
                opacity: 0,
              },
              { ...screen(SOLID), transform: "none", opacity: 1 },
            ],
            { duration, easing: "ease-out", fill: "backwards" },
          ),
        ],
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            [
              { ...screen(SOLID), opacity: 1 },
              {
                ...screen(grain),
                transform: `translate(${delta.x}px, ${delta.y}px)`,
                opacity: 0,
              },
            ],
            { duration: duration * 0.6, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
