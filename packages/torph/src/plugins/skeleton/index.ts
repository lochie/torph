import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type SkeletonOptions = {
  /** How wide the placeholder is, in digit widths. */
  length?: number;
  /** The placeholder's colour. */
  color?: string;
};

/** While the value is empty a shimmering bar holds its place, and the text fades in over it. */
export function skeleton({
  length = 12,
  color = "rgb(128 128 128 / 0.25)",
}: SkeletonOptions = {}): TorphPlugin {
  return {
    name: "skeleton",
    key: `${length}\u0000${color}`,
    // Figure spaces: each as wide as a digit, and none of them a word break.
    whole: (value, { id }) =>
      value ? null : [{ id: id(), string: " ".repeat(length), kind: "bone" }],
    // The shimmer is drawn on the bone's box.
    boxes: (value) => value === "",
    // An endless shimmer, which the morph treats as ambient and never waits on.
    css: `
[torph-kind="bone"] {
  --torph-bone: ${color};
  border-radius: 0.3em;
  background: linear-gradient(90deg, var(--torph-bone) 30%, color-mix(in srgb, var(--torph-bone), white 20%) 50%, var(--torph-bone) 70%) 100% 50% / 300% 70% no-repeat;
  animation: torph-shimmer 1.6s linear infinite;
}
@keyframes torph-shimmer { to { background-position: 0% 50%; } }
`,
    kinds: {
      bone: {
        enter: (box, { duration }) => [
          box.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration,
            fill: "backwards",
          }),
        ],
        // Slower than the text arrives, so the text fades in over the bar.
        exit: (box, { duration }) => [
          box.animate(
            { opacity: 0, offset: 1 },
            {
              duration: duration * 1.5,
              fill: "both",
            },
          ),
        ],
      },
    },
  };
}
