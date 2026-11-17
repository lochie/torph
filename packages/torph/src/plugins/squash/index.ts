import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SquashOptions = {
  /** The most a box stretches, as a share of its size. */
  stretch?: number;
};

// Squashes pivot on the baseline, so text lands on the line rather than shrinking into the air.
const ORIGIN = "50% 100%";

/** Like a cartoon: moving text winds up, stretches along its path and lands with a squash and a wobble; arriving text drops in and splats, leaving text squishes flat and zips away. */
export function squash({ stretch = 0.6 }: SquashOptions = {}): TorphPlugin {
  /** Scale that stretches `by` along the path and thins across it. */
  const along = (across: boolean, by: number) => {
    const thin = 1 / (1 + by);
    return across ? `scale(${1 + by}, ${thin})` : `scale(${thin}, ${1 + by})`;
  };

  return {
    name: "squash",
    key: String(stretch),
    animate: {
      text: {
        persist: (box, { delta, from, line, duration }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          const distance = Math.hypot(x, y);
          if (!distance) return;
          // Further travel stretches more, up to `stretch`, three lines out.
          const s = Math.min(stretch, distance / (line.height * 3));
          const across = Math.abs(x) >= Math.abs(y);
          const at = (k: number, scale: string) =>
            `translate(${x * k}px, ${y * k}px) ${scale}`;
          return [
            box.animate(
              [
                { transform: at(1, "scale(1)") },
                // Wind-up: a little back, bunched up against the push.
                { transform: at(1.06, along(across, -s / 3)), offset: 0.14 },
                { transform: at(0.4, along(across, s)), offset: 0.45 },
                // Past the mark, squashed flat against it.
                { transform: at(-0.08, along(across, -s / 2)), offset: 0.66 },
                { transform: at(0.03, along(across, s / 4)), offset: 0.82 },
                { transform: at(0, along(across, -s / 10)), offset: 0.92 },
                { transform: "none" },
              ].map((frame) => ({
                ...frame,
                transformOrigin: ORIGIN,
                easing: "ease-in-out",
              })),
              { duration: duration * 1.2, fill: "backwards" },
            ),
          ];
        },
        // Dropped in tall and thin, it splats wide, then bounces back to shape.
        enter: (box, { delta, from, duration }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          return [
            box.animate(
              [
                {
                  transform: `translate(${x}px, calc(${y}px - 0.8em)) scale(${1 - stretch / 2}, ${1 + stretch})`,
                  opacity: 0,
                },
                {
                  transform: `translate(${x * 0.3}px, ${y * 0.3}px) scale(${1 + stretch}, ${1 - stretch / 2})`,
                  opacity: 1,
                  offset: 0.45,
                },
                {
                  transform: `scale(${1 - stretch / 5}, ${1 + stretch / 4})`,
                  offset: 0.7,
                },
                { transform: `scale(1.05, 0.96)`, offset: 0.86 },
                { transform: "none" },
              ].map((frame) => ({ ...frame, transformOrigin: ORIGIN })),
              {
                duration: duration * 1.2,
                easing: "ease-out",
                fill: "backwards",
              },
            ),
          ];
        },
        // Squished flat, then gone upward, thin as a pin.
        exit: (box, { delta, duration }) => [
          box.animate(
            [
              { transform: "none", opacity: 1 },
              {
                transform: `translate(${delta.x * 0.3}px, ${delta.y * 0.3}px) scale(${1 + stretch}, ${1 - stretch * 0.6})`,
                opacity: 1,
                offset: 0.35,
              },
              {
                transform: `translate(${delta.x}px, calc(${delta.y}px - 0.8em)) scale(${1 - stretch * 0.7}, ${1 + stretch})`,
                opacity: 0,
              },
            ].map((frame) => ({ ...frame, transformOrigin: ORIGIN })),
            { duration: duration * 0.8, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
