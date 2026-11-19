import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type FlapOptions = {
  /** The drum each flap turns through, in order. */
  glyphs?: string;
  /** The most flips a letter makes, however far round the drum it has to go. */
  flips?: number;
};

/** Like a departure board, each place flips round its drum to the new letter, and nothing slides. */
export function flap({
  glyphs = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:",
  flips = 6,
}: FlapOptions = {}): TorphPlugin {
  /** The letters a flap shows on its way from one to the other, ending on the new one. */
  const drum = (from: string, to: string) => {
    const end = glyphs.indexOf(to.toUpperCase());
    if (end < 0) return [to];
    let at = Math.max(0, glyphs.indexOf(from.toUpperCase()));
    const turns: string[] = [];
    while (at !== end) {
      at = (at + 1) % glyphs.length;
      turns.push(at === end ? to : glyphs[at]!);
    }
    return turns.slice(-flips);
  };

  /** Shows each face in turn, folding down from the top; `add`, so it rides on any slide. */
  const turn = (
    face: HTMLElement,
    from: string,
    duration: number,
    signal: AbortSignal,
  ) => {
    const faces = drum(from, face.textContent ?? "");
    // A tile, like the board's: a wide glyph on the drum can't paint over its neighbours, nor show its back.
    // Not `overflow: clip`: WebKit then moves an inline-block's baseline to its bottom edge, lifting the letter.
    face.style.clipPath = "inset(0)";
    face.style.backfaceVisibility = "hidden";
    const each = duration / faces.length;
    return faces.reduce<Promise<unknown>>(
      (turned, letter) =>
        turned.then(() => {
          // The next morph owns the box now, and its text with it.
          if (signal.aborted) return;
          face.textContent = letter;
          return face.animate(
            [
              { transform: "perspective(20em) rotateX(-90deg)" },
              { transform: "perspective(20em) rotateX(0deg)" },
            ],
            { duration: each, easing: "ease-out", composite: "add" },
          ).finished;
        }),
      Promise.resolve(),
    );
  };

  return {
    name: "flap",
    key: `${glyphs}\u0000${flips}`,
    // Every word, so each keeps its places: letter i of the old word is letter i of the new.
    claim: () => true,
    segment: (word, { previous, id }) =>
      Array.from(word, (letter, i) => ({
        id: previous?.[i]?.id ?? id(),
        string: letter,
      })),
    // Any word flips to the one in its place.
    affinity: () => 1,
    runs: { claim: () => true },
    animate: {
      text: {
        persist: (
          box,
          { mover, was, delta, from, duration, ease, signal, animate },
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
          if (was === undefined || was === mover.textContent) return slide;
          return Promise.all([
            ...slide.map((a) => a.finished),
            turn(mover, was, duration, signal),
          ]);
        },
        enter: (_box, { mover, duration, signal }) =>
          turn(mover, " ", duration, signal),
        exit: (box, { duration, animate }) => [
          animate(
            box,
            {
              transform: "perspective(20em) rotateX(90deg)",
              opacity: 0,
              offset: 1,
            },
            { duration: duration / 2, easing: "ease-in", fill: "both" },
          ),
        ],
      },
    },
  };
}
