import { mask, type MaskOptions } from "../mask";

export type TickerOptions = Pick<MaskOptions, "from" | "bounce">;

/** New text pushes the old out of the same mask in one motion, like a status pill or a live count. */
export function ticker({ from = "auto", bounce = false }: TickerOptions = {}) {
  // mask with nothing tipped, staggered or held back: old and new move as one.
  return {
    ...mask({ from, bounce, tilt: 0, stagger: 0, clear: 0 }),
    name: "ticker",
  };
}
