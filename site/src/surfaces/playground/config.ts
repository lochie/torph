import { DEFAULT_TEXT_MORPH_OPTIONS } from "torph";

export const EASINGS = {
  default: DEFAULT_TEXT_MORPH_OPTIONS.ease,
  spring: { stiffness: 200, damping: 20, mass: 1 },
  linear: "linear",
} as const;
export type EasingKey = keyof typeof EASINGS;

export const SPEEDS = {
  default: DEFAULT_TEXT_MORPH_OPTIONS.duration,
  slow: 3000,
  fast: 150,
} as const;
export type Speed = keyof typeof SPEEDS;

export const ALIGNS = ["left", "center", "right"] as const;
export type Align = (typeof ALIGNS)[number];

// ── Numbers ──

// en-IN earns its place: lakh/crore grouping (12,34,567) puts separators where
// no other locale does, so it catches grouping assumed to be every three digits.
export const LOCALES = ["en", "de-DE", "en-IN"] as const;
export type Locale = (typeof LOCALES)[number];

export const DECIMALS = { auto: undefined, "0": 0, "2": 2 } as const;
export type DecimalsKey = keyof typeof DECIMALS;
