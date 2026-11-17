import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type RevealOptions = {
  /** Each character's turn after the one before, as a share of the duration. */
  stagger?: number;
};

/** Each place keeps its box, and turns over in place to its new character: a masked value revealed. */
export function reveal({ stagger = 0.08 }: RevealOptions = {}): TorphPlugin {
  return {
    name: "reveal",
    key: `${stagger}`,
    // Every word, so character i of the old is character i of the new.
    claim: () => true,
    segment: (word, { previous, id }) =>
      Array.from(word, (char, i) => ({
        id: previous?.[i]?.id ?? id(),
        string: char,
      })),
    affinity: () => 1,
    runs: { claim: () => true },
    animate: {
      text: {
        persist: (box, { mover, was, index, duration, signal }) => {
          const text = mover.textContent ?? "";
          if (was === undefined || was === text) return;
          const half = duration / 3;
          // Shows the old character until its turn, then turns it edge-on and back as the new one.
          mover.textContent = was;
          return mover
            .animate(
              [
                { transform: "perspective(20em) rotateY(0deg)" },
                { transform: "perspective(20em) rotateY(90deg)" },
              ],
              {
                duration: half,
                delay: index * stagger * duration,
                easing: "ease-in",
              },
            )
            .finished.then(() => {
              // The next morph owns the box now, and its text with it.
              if (signal.aborted) return;
              mover.textContent = text;
              return mover.animate(
                [
                  { transform: "perspective(20em) rotateY(-90deg)" },
                  { transform: "perspective(20em) rotateY(0deg)" },
                ],
                { duration: half, easing: "ease-out" },
              ).finished;
            });
        },
      },
    },
  };
}
