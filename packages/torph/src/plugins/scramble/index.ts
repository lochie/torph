import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type ScrambleOptions = {
  /** Drawn from while a letter scrambles. */
  glyphs?: string;
  /** How often the glyphs change, in ms. */
  rate?: number;
  /** Each letter's start after the one before, as a share of the duration. */
  stagger?: number;
};

/** Letter by letter, arriving text scrambles into place and leaving text scrambles away. */
export function scramble({
  glyphs = "abcdefghijklmnopqrstuvwxyz0123456789",
  rate = 40,
  stagger = 0.08,
}: ScrambleOptions = {}): TorphPlugin {
  const random = (text: string) =>
    text.replace(
      /\S/g,
      () => glyphs[Math.floor(Math.random() * glyphs.length)]!,
    );
  // Spread over at most half the duration, however many letters move on that side.
  const start = (index: number, count: number, duration: number) =>
    index * Math.min(stagger, 0.5 / Math.max(1, count - 1)) * duration;

  /** Shows random glyphs in `box` from `from` ms until `until` ms, then hands back. */
  const scrambling = (
    box: HTMLElement,
    text: string,
    from: number,
    until: number,
    signal: AbortSignal,
  ) =>
    new Promise<void>((resolve) => {
      const began = performance.now();
      let last = -Infinity;
      const tick = (now: number) => {
        // The next morph owns the box now, and its text with it.
        if (signal.aborted) return resolve();
        const at = now - began;
        if (at >= until) return resolve();
        if (at >= from && now - last >= rate) {
          last = now;
          box.textContent = random(text);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  return {
    name: "scramble",
    key: `${glyphs}\u0000${rate}\u0000${stagger}`,
    letters: true,
    // Taken from group replacement, so a long replaced run still goes letter by letter.
    runs: { claim: () => true },
    animate: {
      text: {
        // Hidden until its turn, then scrambling until it locks on, in reading order.
        enter: (box, { mover, index, arriving, duration, signal, animate }) => {
          const text = mover.textContent ?? "";
          const appear = start(index, arriving, duration);
          animate(box, [{ opacity: 0 }, { opacity: 0 }], { duration: appear });
          return scrambling(
            mover,
            text,
            appear,
            appear + duration / 2,
            signal,
          ).then(() => {
            if (!signal.aborted) mover.textContent = text;
          });
        },
        // Scrambling from the start, each dropping out in turn; the engine removes it after.
        exit: (box, { index, leaving, duration, signal }) =>
          scrambling(
            box,
            box.textContent ?? "",
            0,
            start(index, leaving, duration) + duration / 4,
            signal,
          ),
      },
    },
  };
}
