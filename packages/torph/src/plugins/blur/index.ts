import type { TorphPlugin } from "../../lib/text-morph/plugin";

// Fitted to the reference numeric-text effect: 1.5% overshoot, settled in about half a second.
const SPRING = { stiffness: 265, damping: 26 };

export type BlurOptions = {
  /** How out of focus a letter is as it arrives and leaves, as a CSS length. */
  amount?: string;
  /** How far a letter rises as it arrives and leaves, as a CSS length. */
  rise?: string;
  /** Each letter's delay after the one before, as a share of the duration. */
  stagger?: number;
};

/** Letter by letter, text rises into focus and blurs away upwards. */
export function blur({
  amount = "0.1em",
  rise = "0.35em",
  stagger = 0.15,
}: BlurOptions = {}): TorphPlugin {
  const filter = `blur(${amount})`;
  // Spread over at most 30% of the duration, however many letters move on that side.
  const delay = (index: number, count: number, duration: number) =>
    index * Math.min(stagger, 0.3 / Math.max(1, count - 1)) * duration;
  const away = (x: number, y: number, side: "+" | "-") =>
    `translate(${x}px, calc(${y}px ${side} ${rise})) scale(0.6) rotate(2deg)`;

  return {
    name: "blur",
    key: `${amount}\u0000${rise}\u0000${stagger}`,
    ease: SPRING,
    letters: true,
    // A word that would slide across the line blurs out and back in where it lands instead.
    maxShift: 3,
    // Taken from group replacement, so a long replaced run still goes letter by letter.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, ease, index, arriving }) => [
          box.animate(
            [
              {
                transform: away(
                  delta.x + (from?.tx ?? 0),
                  delta.y + (from?.ty ?? 0),
                  "+",
                ),
                filter,
                opacity: 0,
              },
              { transform: "none", filter: "none", opacity: 1 },
            ],
            {
              duration,
              delay: delay(index, arriving, duration),
              easing: ease,
              fill: "backwards",
            },
          ),
        ],
        exit: (box, { delta, duration, ease, index, leaving }) => [
          box.animate(
            {
              transform: away(delta.x, delta.y, "-"),
              filter,
              opacity: 0,
              offset: 1,
            },
            {
              duration,
              delay: delay(index, leaving, duration),
              easing: ease,
              fill: "both",
            },
          ),
        ],
      },
    },
  };
}
