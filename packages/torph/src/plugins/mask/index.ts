import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { lineOf, type Lines } from "../line";
import { went } from "../went";

export type MaskOptions = {
  /** How far text tips back as it comes in, in degrees. */
  tilt?: number;
  /** Each word's start after the one before, as a share of the duration. */
  stagger?: number;
  /** What the stagger steps by: each word, or each line, the whole line rising together. */
  cascade?: "word" | "line";
  /** A mask per letter, rather than per word. */
  letters?: boolean;
  /** Where new text comes in from. `"auto"` rises for a higher figure and drops for a lower one; a function picks per morph. */
  from?: Side | "auto" | ((change: { from: string; to: string }) => Side);
  /** New text overshoots its place a little, and settles back. */
  bounce?: boolean;
  /** The share of the duration old text has to leave before new text follows; 0 moves them together. */
  clear?: number;
};

type Side = "below" | "above" | "left" | "right";
type State = Lines & { edge: Side };

const LENS = "perspective(10em)";
// Letters that reach furthest above and below the line, so the mask clears them.
const INK = "ÅÉÖbdfghjklpqtyÿ";
const OVERSHOOT = "cubic-bezier(0.34, 1.56, 0.64, 1)";
// The slot mask only clips above and below; sideways, the box's own edges are the mask too.
const SIDEWAYS_CLIP = "inset(0 0 0 0)";

/**
 * What arrives comes into place from behind its line, tipping up as it comes, and what
 * leaves goes out of it; what stays, stays, split as torph splits it. Each box's outer
 * box is the mask: it moves only with its line, while the text inside it moves, so the
 * mask holds still on every line.
 */
export function mask({
  tilt = 45,
  stagger = 0.04,
  cascade = "word",
  letters = false,
  from: side = "below",
  bounce = false,
  clear = 0.25,
}: MaskOptions = {}): TorphPlugin<State> {
  /** Where text sits outside the mask on one side, `far` px past its edge, and how it's tipped there. */
  const outside = (edge: "below" | "above" | "left" | "right", far: number) => {
    const sideways = edge === "left" || edge === "right";
    const sign = edge === "below" || edge === "right" ? 1 : -1;
    const shift = sideways
      ? `translateX(calc(${sign * 100}% + ${sign * 0.2}em))`
      : `translateY(${sign * far}px)`;
    const tip = sideways
      ? `rotateY(${sign * tilt}deg)`
      : `rotateX(${-sign * tilt}deg)`;
    // Tipped on the edge nearest its place, so it swings in rather than spins.
    const origin = {
      below: "50% 0",
      above: "50% 100%",
      right: "0 50%",
      left: "100% 50%",
    }[edge];
    return { transform: `${LENS} ${shift} ${tip}`, transformOrigin: origin };
  };
  const level = (origin: string) => ({
    transform: `${LENS} translate(0px, 0px) rotateX(0deg) rotateY(0deg)`,
    transformOrigin: origin,
  });
  const opposite = {
    below: "above",
    above: "below",
    left: "right",
    right: "left",
  } as const;
  const pick = (change: { from: string; to: string }): Side =>
    typeof side === "function"
      ? side(change)
      : side === "auto"
        ? went(change.from, change.to) === "down"
          ? "above"
          : "below"
        : side;

  return {
    name: "mask",
    // A function is kept from the first morph, not rebuilt per render: it should read live values from a ref.
    key: [
      tilt,
      stagger,
      cascade,
      letters,
      typeof side === "function" ? "fn" : side,
      bounce,
      clear,
    ].join("\u0000"),
    letters,
    read: (_root, _style, change) => ({ lines: null, edge: pick(change) }),
    idle: { lines: null, edge: "below" },
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        // The engine's slot mask, the one numbers() slides digits behind, measured for letters.
        slot: true,
        ink: INK,
        enter: (box, ctx) => {
          const {
            mover,
            delta,
            from,
            line,
            duration,
            ease,
            index,
            arriving,
            state,
            animate,
          } = ctx;
          const edge = state.edge;
          const start = outside(edge, line.clear);
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          // After the old text has cleared the mask, then a word or a line at a time, the last within half the duration.
          const step =
            cascade === "line"
              ? lineOf(box, state) * 0.12
              : index * Math.min(stagger, 0.25 / Math.max(1, arriving - 1));
          const sideways = edge === "left" || edge === "right";
          return [
            // The mask rides with its line, as any arriving box would.
            ...(x || y
              ? [
                  box.animate(
                    [
                      { transform: `translate(${x}px, ${y}px)` },
                      { transform: "none" },
                    ],
                    { duration, easing: ease, fill: "backwards" },
                  ),
                ]
              : []),
            ...(sideways
              ? [
                  box.animate(
                    [{ clipPath: SIDEWAYS_CLIP }, { clipPath: SIDEWAYS_CLIP }],
                    { duration: duration * (1 + clear) },
                  ),
                ]
              : []),
            animate(mover, [start, level(start.transformOrigin)], {
              duration,
              delay: (clear + step) * duration,
              easing: bounce ? OVERSHOOT : ease,
              fill: "backwards",
            }),
          ];
        },
        // Quickly, so the mask is clear before anything comes into it; with no head start, in step with what arrives.
        exit: (box, { mover, line, duration, ease, state, animate }) => {
          const edge = opposite[state.edge];
          const end = outside(edge, line.clear);
          const sideways = edge === "left" || edge === "right";
          const time = clear > 0 ? duration * clear * 1.6 : duration;
          return [
            ...(sideways
              ? [
                  box.animate(
                    [{ clipPath: SIDEWAYS_CLIP }, { clipPath: SIDEWAYS_CLIP }],
                    { duration: time, fill: "both" },
                  ),
                ]
              : []),
            animate(mover, [level(end.transformOrigin), end], {
              duration: time,
              easing: clear > 0 ? "cubic-bezier(0.4, 0, 0.7, 0.6)" : ease,
              fill: "both",
            }),
          ];
        },
      },
    },
  };
}
