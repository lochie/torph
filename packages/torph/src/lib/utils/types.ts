import type { SpringParams } from "./spring";
import type { Format } from "../text-morph/utils/content";

/** Numeric segments slide instead of fading, and digits and symbols slide opposite ways. */
export type SegmentKind = "digit" | "symbol";

export type Segment = {
  id: string;
  string: string;
  /** Absent for ordinary text. */
  kind?: SegmentKind;
  /** An atomic element segment — `string` holds its token, never text to render. */
  node?: Element;
  /** Inline tags rebuilt around this segment's text. */
  format?: Format;
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
