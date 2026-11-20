import type { TorphPlugin } from "../../lib/text-morph/plugin";

/** A letter that only changes case keeps its box, and pops to the new one in place. */
export function caseless(): TorphPlugin {
  return {
    name: "caseless",
    fold: (char) => char.toLowerCase(),
    affinity: (a, b) => (a.toLowerCase() === b.toLowerCase() ? 1 : null),
    animate: {
      text: {
        persist: (box, { was, delta, from, duration, ease, animate }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          const changed = was !== undefined && was !== box.textContent;
          if (!x && !y && !changed) return;
          return [
            animate(
              box,
              [
                changed
                  ? {
                      transform: `translate(${x}px, ${y}px) scale(0.7)`,
                      opacity: 0.4,
                    }
                  : { transform: `translate(${x}px, ${y}px)` },
                { transform: "none", opacity: 1 },
              ],
              { duration, easing: ease, fill: "backwards" },
            ),
          ];
        },
      },
    },
  };
}
