import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type WeightOptions = {
  /** The weight a letter arrives at, before it relaxes to the text's own. Needs a variable font. */
  heavy?: number;
  /** The weight a leaving letter thins to. */
  light?: number;
};

/** Letter by letter, new text arrives heavy and relaxes to its weight; leaving text thins away. */
export function weight({
  heavy = 900,
  light = 100,
}: WeightOptions = {}): TorphPlugin {
  return {
    name: "weight",
    key: `${heavy}\u0000${light}`,
    letters: true,
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { duration, ease }) => [
          box.animate(
            [
              { fontWeight: String(heavy), opacity: 0 },
              { opacity: 1, offset: 0.25 },
            ],
            { duration: duration * 1.5, easing: ease, fill: "backwards" },
          ),
        ],
        exit: (box, { duration }) => [
          box.animate(
            { fontWeight: String(light), opacity: 0, offset: 1 },
            { duration, fill: "both" },
          ),
        ],
      },
    },
  };
}
