import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type RollOptions = {
  /** Which way the barrel turns. */
  direction?: "up" | "down";
};

// The barrel's axis, behind the text: deep enough to read as a drum, shallow enough to stay in its line.
const AXIS = "50% 50% -0.6em";
const LENS = "perspective(12em)";

/** The whole value is one face of a turning barrel: the old one rolls away as the new one comes round. */
export function roll({ direction = "up" }: RollOptions = {}): TorphPlugin {
  const turn = direction === "up" ? 90 : -90;
  return {
    name: "roll",
    key: direction,
    whole: (value, { id }) =>
      value ? [{ id: id(), string: value, kind: "face" }] : [],
    // A face keeps the value's own line breaks.
    css: `[torph-kind="face"] { white-space: pre; backface-visibility: hidden; }`,
    kinds: {
      face: {
        enter: (box, { duration, ease, animate }) => [
          animate(
            box,
            [
              {
                transform: `${LENS} rotateX(${-turn}deg)`,
                transformOrigin: AXIS,
                opacity: 0,
              },
              { opacity: 1, offset: 0.4 },
              { transform: `${LENS} rotateX(0deg)`, transformOrigin: AXIS },
            ],
            { duration, easing: ease, fill: "backwards" },
          ),
        ],
        exit: (box, { duration, ease, animate }) => [
          animate(
            box,
            [
              { transform: `${LENS} rotateX(0deg)`, transformOrigin: AXIS },
              { opacity: 1, offset: 0.6 },
              {
                transform: `${LENS} rotateX(${turn}deg)`,
                transformOrigin: AXIS,
                opacity: 0,
              },
            ],
            { duration, easing: ease, fill: "both" },
          ),
        ],
      },
    },
  };
}
