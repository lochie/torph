import type { SpringParams } from "./utils/spring";

export interface TextMorphOptions {
  debug?: boolean;
  element: HTMLElement;
  locale?: Intl.LocalesArgument;
  scale?: boolean;
  duration?: number; // in ms
  ease?: string | SpringParams;
  disabled?: boolean;
  respectReducedMotion?: boolean;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}
