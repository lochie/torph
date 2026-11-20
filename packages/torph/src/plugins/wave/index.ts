import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type WaveOptions = {
  /** How far a letter drops in from, and falls away, as a CSS length. */
  height?: string;
  /** Each letter's start after the one before, as a share of the duration. */
  stagger?: number;
};

/** Letter by letter, text drops in with a bounce and falls away under its own weight. */
export function wave({
  height = "0.6em",
  stagger = 0.12,
}: WaveOptions = {}): TorphPlugin {
  const delay = (index: number, count: number, duration: number) =>
    index * Math.min(stagger, 0.3 / Math.max(1, count - 1)) * duration;

  return {
    name: "wave",
    key: `${height}\u0000${stagger}`,
    // Underdamped, so each letter lands with a little bounce.
    ease: { stiffness: 320, damping: 14 },
    letters: true,
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
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, calc(${delta.y + (from?.ty ?? 0)}px - ${height})) rotate(-6deg)`,
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
        // All at once, with no stagger: leaving text gets out of the way of what arrives.
        // The fall speeds up like a drop, but the fade starts at once, so it reads as gone straight away.
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            {
              transform: `translate(${delta.x}px, calc(${delta.y}px + ${height})) rotate(10deg)`,
              offset: 1,
            },
            {
              duration: duration * 0.4,
              easing: "cubic-bezier(0.4, 0, 1, 1)",
              fill: "both",
            },
          ),
          animate(
            box,
            { opacity: 0, offset: 1 },
            { duration: duration * 0.25, easing: "ease-out", fill: "both" },
          ),
        ],
      },
    },
  };
}
