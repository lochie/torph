import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type LookalikeOptions = {
  /** Families of glyphs that look alike; a letter turns into another through its family. */
  families?: string[];
  /** How long each glyph on the way shows, in ms. */
  rate?: number;
};

const FAMILIES = [
  "OQØ0Dθo°",
  "Il1|!iíjJ",
  "S5$sz2Z",
  "B83&Ee",
  "A4ΛVvuUnm",
  "G6bCc(",
  "T7Yy+t",
  "g9qpPR",
  "a@d",
  "hkKXx",
  "rfF",
  "wWM",
];

/** Each changing letter steps through glyphs that look like it on its way to the new one. */
export function lookalike({
  families = FAMILIES,
  rate = 45,
}: LookalikeOptions = {}): TorphPlugin {
  const family = (char: string) => families.find((f) => f.includes(char));
  /** The glyphs between `from` and `to`: along one family, or out of one and into the other. */
  const path = (from: string, to: string) => {
    const a = family(from);
    const b = family(to);
    if (a && a === b) {
      const [i, j] = [a.indexOf(from), a.indexOf(to)];
      const step = i < j ? 1 : -1;
      return Array.from(
        { length: Math.abs(j - i) },
        (_, k) => a[i + step * (k + 1)]!,
      );
    }
    const near = (f: string | undefined, c: string) =>
      f ? f[(f.indexOf(c) + 1) % f.length]! : c;
    return [near(a, from), near(b, to), to].filter((c) => c !== from);
  };
  /** Shows each glyph of `steps` in turn in `box`, starting `wait` ms in. */
  const run = (
    box: HTMLElement,
    steps: string[],
    wait: number,
    signal: AbortSignal,
  ) =>
    new Promise<void>((resolve) => {
      steps.forEach((glyph, i) => {
        const timer = setTimeout(
          () => {
            // The next morph owns the box now, and its text with it.
            if (!signal.aborted) box.textContent = glyph;
            if (i === steps.length - 1) resolve();
          },
          wait + i * rate,
        );
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (steps.length === 0) resolve();
    });
  return {
    name: "lookalike",
    key: `${families.join("\u0000")}\u0000${rate}`,
    // Every word, so letter i of the old is letter i of the new.
    claim: () => true,
    segment: (word, { previous, id }) =>
      Array.from(word, (letter, i) => ({
        id: previous?.[i]?.id ?? id(),
        string: letter,
      })),
    affinity: () => 1,
    runs: { claim: () => true },
    animate: {
      text: {
        persist: (
          box,
          { mover, was, delta, from, index, duration, ease, signal, animate },
        ) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          const slide =
            x || y
              ? [
                  animate(
                    box,
                    [
                      { transform: `translate(${x}px, ${y}px)` },
                      { transform: "none" },
                    ],
                    { duration, easing: ease, fill: "backwards" },
                  ),
                ]
              : [];
          const text = mover.textContent ?? "";
          if (was === undefined || was === text) return slide;
          mover.textContent = was;
          return Promise.all([
            ...slide.map((a) => a.finished),
            run(mover, path(was, text), index * rate * 0.5, signal),
          ]);
        },
        enter: (box, { mover, index, duration, signal, animate }) => {
          const text = mover.textContent ?? "";
          const steps = path(" ", text);
          mover.textContent = steps[0] ?? text;
          animate(box, [{ opacity: 0 }, { opacity: 1 }], {
            duration: duration / 3,
            fill: "backwards",
          });
          return run(mover, steps.slice(1), index * rate * 0.5 + rate, signal);
        },
        exit: (box, { duration, animate }) => [
          animate(
            box,
            { opacity: 0, offset: 1 },
            { duration: duration / 2, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
