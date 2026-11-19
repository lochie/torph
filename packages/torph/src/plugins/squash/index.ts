import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SquashOptions = {
  /** The most a letter stretches, as a share of its size. */
  stretch?: number;
  /** How high a moving letter hops, as a CSS length. */
  hop?: string;
};

// Squashes pivot on the baseline, so letters land on the line rather than shrinking into the air.
const ORIGIN = "50% 100%";
// Each letter's lean, by its place: a jumble, so they don't move as one.
const TILT = [-9, 6, -4, 10, -7, 3, 8, -5];

/** Like a cartoon: letters hop to new places, crouching, stretching and landing with a splat; new ones drop in and bounce, old ones pop away. */
export function squash({
  stretch = 0.5,
  hop = "0.6em",
}: SquashOptions = {}): TorphPlugin {
  const s = stretch;
  const tall = `scale(${1 - s / 2}, ${1 + s})`;
  const flat = `scale(${1 + s}, ${1 - s / 2})`;
  // Each letter after the one before, but the last starts within a third of the duration.
  const delay = (index: number, count: number, duration: number) =>
    index * Math.min(0.05, 1 / 3 / Math.max(1, count - 1)) * duration;

  return {
    name: "squash",
    key: `${stretch}\u0000${hop}`,
    letters: true,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        // A hop, not a slide: crouch, take off stretched, arc over, land squashed, wobble.
        persist: (box, { delta, from, duration, index, animate }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          if (!x && !y) return;
          const tilt = TILT[index % TILT.length]!;
          const at = (k: number, lift: number, pose: string) =>
            `translate(${x * k}px, calc(${y * k}px - ${hop} * ${lift})) ${pose}`;
          return [
            animate(
              box,
              [
                { transform: at(1, 0, "scale(1)") },
                { transform: at(1, 0, flat), offset: 0.12 },
                {
                  transform: at(0.75, 0.7, `${tall} rotate(${tilt}deg)`),
                  offset: 0.3,
                },
                { transform: at(0.5, 1, `rotate(${-tilt}deg)`), offset: 0.48 },
                { transform: at(0.15, 0.5, tall), offset: 0.64 },
                { transform: at(0, 0, flat), offset: 0.76 },
                {
                  transform: `scale(${1 - s / 5}, ${1 + s / 4})`,
                  offset: 0.87,
                },
                { transform: "none" },
              ].map((frame) => ({ ...frame, transformOrigin: ORIGIN })),
              {
                duration: duration * 1.4,
                delay: (index % 4) * duration * 0.03,
                easing: "ease-in-out",
                fill: "backwards",
              },
            ),
          ];
        },
        // Dropped in tall, one after another: a splat, a bounce, a smaller bounce.
        enter: (box, { delta, from, duration, index, arriving, animate }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          const tilt = TILT[index % TILT.length]!;
          return [
            animate(
              box,
              [
                {
                  transform: `translate(${x}px, calc(${y}px - 1.2em)) ${tall} rotate(${tilt}deg)`,
                  opacity: 0,
                },
                { opacity: 1, offset: 0.15 },
                { transform: flat, offset: 0.4 },
                {
                  transform: `translateY(calc(${hop} * -0.4)) scale(0.92, 1.12) rotate(${-tilt / 2}deg)`,
                  offset: 0.58,
                },
                { transform: `scale(1.12, 0.9)`, offset: 0.74 },
                { transform: `translateY(calc(${hop} * -0.1))`, offset: 0.86 },
                { transform: "none" },
              ].map((frame) => ({ ...frame, transformOrigin: ORIGIN })),
              {
                duration: duration * 1.5,
                delay: delay(index, arriving, duration),
                easing: "ease-out",
                fill: "backwards",
              },
            ),
          ];
        },
        // A crouch, then up and away with a spin.
        exit: (box, { delta, duration, index, animate }) => {
          const tilt = TILT[index % TILT.length]!;
          return [
            animate(
              box,
              [
                { transform: "none", opacity: 1 },
                {
                  transform: `translate(${delta.x * 0.2}px, ${delta.y * 0.2}px) ${flat}`,
                  offset: 0.3,
                },
                {
                  transform: `translate(${delta.x}px, calc(${delta.y}px - 1.4em)) ${tall} rotate(${tilt * 3}deg)`,
                  opacity: 0,
                },
              ].map((frame) => ({ ...frame, transformOrigin: ORIGIN })),
              { duration: duration * 0.8, easing: "ease-in", fill: "both" },
            ),
          ];
        },
      },
    },
  };
}
