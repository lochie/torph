import type { SpringParams } from "./spring";

export type Segment = {
  id: string;
  string: string;
  /** The plugin-defined kind that picks the segment's hooks; absent for ordinary text. */
  kind?: string;
};

export interface BaseMorphOptions {
  element: HTMLElement;
  /** Ignored when `ease` is a spring, which settles on its own physics. */
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
