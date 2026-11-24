import type { TorphPlugin } from "../../lib/text-morph/plugin";

// Prefix, the run from the first digit to the last, suffix.
const PARTS = /^(\D*)(\d(?:.*\d)?)(\D*)$/u;

/** A figure's parts and value, read the English way: "," groups, "." is the decimal point. */
function figure(text: string) {
  const [, before = "", core = "", after = ""] = PARTS.exec(text) ?? [];
  if (!core || /[^\d.,]/.test(core)) return null;
  const n = Number(core.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return {
    before,
    after,
    n: /[-−(]/.test(before) ? -n : n,
    decimals: core.split(".")[1]?.length ?? 0,
    grouped: core.includes(","),
  };
}

export type CountupOptions = {
  /** How long the count takes, in ms. */
  time?: number;
  /** How many values it passes through on the way. */
  steps?: number;
};

/** A figure counts through the values between, quick at first and slowing as it arrives. */
export function countup({
  time = 1000,
  steps = 24,
}: CountupOptions = {}): TorphPlugin {
  return {
    name: "countup",
    key: `${time}\u0000${steps}`,
    tween: (from, to) => {
      const a = figure(from);
      const b = figure(to);
      if (!a || !b || a.n === b.n) return null;
      const format = new Intl.NumberFormat("en", {
        minimumFractionDigits: b.decimals,
        maximumFractionDigits: b.decimals,
        useGrouping: b.grouped,
      });
      const frames: { value: string; at: number }[] = [];
      for (let i = 0; i < steps; i++) {
        const t = (i + 1) / steps;
        // Evenly spaced in time, eased in value: big jumps first, small ones at the end.
        const n = a.n + (b.n - a.n) * (1 - (1 - t) ** 3);
        const value =
          i === steps - 1
            ? to
            : `${n < 0 ? "-" : ""}${b.before.replace(/[-−]/, "")}${format.format(Math.abs(n))}${b.after}`;
        if (value !== frames.at(-1)?.value)
          frames.push({ value, at: (time * i) / steps });
      }
      return frames;
    },
  };
}
