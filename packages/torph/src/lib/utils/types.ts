import type { SpringParams } from "./spring";

/** Numeric segments slide instead of fading, and digits and symbols slide opposite ways. */
export type SegmentKind = "digit" | "symbol";

export type Segment = {
  id: string;
  string: string;
  /** Absent for ordinary text. */
  kind?: SegmentKind;
};

export interface BaseMorphOptions {
  element: HTMLElement;
  duration?: number;
  ease?: string | SpringParams;
  locale?: Intl.LocalesArgument;
  disabled?: boolean;
  respectReducedMotion?: boolean;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

export const BASE_DEFAULTS = {
  locale: "en",
  duration: 400,
  ease: "cubic-bezier(0.19, 1, 0.22, 1)",
  disabled: false,
  respectReducedMotion: true,
} as const;
