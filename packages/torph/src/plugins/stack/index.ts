import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type StackOptions = {
  /** How far the cards travel, as a CSS length. */
  rise?: string;
};

/** The whole value is one card: the old one slides up and away as the new one rises in. */
export function stack({ rise = "0.8em" }: StackOptions = {}): TorphPlugin {
  return {
    name: "stack",
    key: rise,
    whole: (value, { id }) =>
      value ? [{ id: id(), string: value, kind: "card" }] : [],
    // A card keeps the value's own line breaks.
    css: `[torph-kind="card"] { white-space: pre; }`,
    kinds: {
      card: {
        enter: (box, { duration, ease }) => [
          box.animate(
            [
              { transform: `translateY(${rise})`, opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
            { duration, easing: ease, fill: "backwards" },
          ),
        ],
        exit: (box, { duration, ease }) => [
          box.animate(
            { transform: `translateY(-${rise})`, opacity: 0, offset: 1 },
            { duration, easing: ease, fill: "both" },
          ),
        ],
      },
    },
  };
}
