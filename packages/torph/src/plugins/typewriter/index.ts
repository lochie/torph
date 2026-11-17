import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type TypewriterOptions = {
  /** Time per keystroke, in ms. */
  keystroke?: number;
};

/** Old text backspaces from the end, then the new text types in, caret and all. */
export function typewriter({
  keystroke = 45,
}: TypewriterOptions = {}): TorphPlugin {
  // A sliver of shadow past the box's right edge is the caret.
  const caret = "0.06em 0 0 0 currentColor";

  return {
    name: "typewriter",
    key: String(keystroke),
    letters: true,
    runs: { claim: () => true },
    animate: {
      text: {
        // Last letter first, each holding the caret until it goes.
        exit: (box, { index, leaving }) => [
          box.animate(
            [
              { boxShadow: caret, opacity: 1 },
              { boxShadow: caret, opacity: 1, offset: 0.999 },
              { boxShadow: "none", opacity: 0 },
            ],
            {
              duration: keystroke,
              delay: (leaving - 1 - index) * keystroke,
              fill: "forwards",
            },
          ),
        ],
        // Once the old text is gone, in reading order, the caret passing along.
        enter: (box, { index, leaving }) => [
          box.animate(
            [
              { opacity: 0 },
              { boxShadow: caret, opacity: 1, offset: 0.001 },
              { boxShadow: caret, opacity: 1, offset: 0.999 },
              { boxShadow: "none", opacity: 1 },
            ],
            {
              duration: keystroke,
              delay: (leaving + index) * keystroke,
              fill: "backwards",
            },
          ),
        ],
      },
    },
  };
}
