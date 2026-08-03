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
