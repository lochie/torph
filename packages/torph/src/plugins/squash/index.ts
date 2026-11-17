import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SquashOptions = {
  /** The most a moving box stretches, as a share of its size. */
  stretch?: number;
};

/** Moving text stretches along its path, then squashes as it lands, like rubber. */
export function squash({ stretch = 0.35 }: SquashOptions = {}): TorphPlugin {
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
          // Further travel stretches more, up to `stretch`, eight lines out.
          const s = Math.min(stretch, distance / (line.height * 8));
          const across = Math.abs(x) >= Math.abs(y);
          const [sx, sy] = across ? [1 + s, 1 - s / 2] : [1 - s / 2, 1 + s];
          const [qx, qy] = across
            ? [1 - s / 2, 1 + s / 3]
            : [1 + s / 3, 1 - s / 2];
          return [
            box.animate(
              [
                { transform: `translate(${x}px, ${y}px)` },
                {
                  transform: `translate(${x * 0.4}px, ${y * 0.4}px) scale(${sx}, ${sy})`,
                  offset: 0.45,
                },
                { transform: `scale(${qx}, ${qy})`, offset: 0.8 },
                { transform: "none" },
              ],
              { duration, easing: "ease-in-out", fill: "backwards" },
            ),
          ];
        },
      },
    },
  };
}
