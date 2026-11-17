import type { HookSet, TorphPlugin } from "../../lib/text-morph/plugin";

export type WipeOptions = {
  /** How much of the duration the edge takes to cross the value. */
  sweep?: number;
};

/** An edge crosses the value left to right, wiping the old text away and revealing the new. */
export function wipe({ sweep = 0.8 }: WipeOptions = {}): TorphPlugin {
  /** When the edge reaches the box's left side, and how long it takes to cross it. */
  const crossing = (
    at: { x: number; width: number } | undefined,
    width: number,
    duration: number,
  ) => {
    const span = duration * sweep;
    if (!at || !width) return { delay: 0, duration: span };
    return {
      delay: (at.x / width) * span,
      duration: Math.max(1, (at.width / width) * span),
    };
  };

  const hooks: HookSet<unknown> = {
    enter: (box, { at, extent, duration }) => [
      box.animate(
        [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        { ...crossing(at, extent.width, duration), fill: "backwards" },
      ),
    ],
    exit: (box, { at, extent, duration }) => [
      box.animate(
        [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }],
        { ...crossing(at, extent.width, duration), fill: "both" },
      ),
    ],
  };

  return {
    name: "wipe",
    key: String(sweep),
    runs: { claim: () => true },
    // Numbers too: an earlier plugin's hooks come before the built-in's own.
    animate: { text: hooks, digit: hooks, symbol: hooks },
  };
}
