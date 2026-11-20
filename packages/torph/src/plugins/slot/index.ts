import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SlotOptions = {
  /** Which way text rolls through the window. */
  direction?: "up" | "down";
};

/** Each change rolls through a window the size of its box: the old text out one edge, the new in the other. */
export function slot({ direction = "up" }: SlotOptions = {}): TorphPlugin {
  // The clip moves with the box, so it's cut back by as much as the box rolls, and the window holds still.
  const below = direction === "up";
  const offset = below ? "100%" : "-100%";
  const hidden = below ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)";
  const gone = below ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)";
  return {
    name: "slot",
    key: direction,
    // Every replaced run, so groups() can't move it as one shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, ease, animate }) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, calc(${delta.y + (from?.ty ?? 0)}px + ${offset}))`,
                clipPath: hidden,
              },
              { transform: "none", clipPath: "inset(0 0 0 0)" },
            ],
            { duration, easing: ease, fill: "backwards" },
          ),
        ],
        exit: (box, { delta, duration, ease, animate }) => [
          animate(
            box,
            [
              { clipPath: "inset(0 0 0 0)" },
              {
                transform: `translate(${delta.x}px, calc(${delta.y}px - ${offset}))`,
                clipPath: gone,
              },
            ],
            { duration, easing: ease, fill: "both" },
          ),
        ],
      },
    },
  };
}
