export interface TextMorphOptions {
  debug?: boolean;
  element: HTMLElement;
  locale?: Intl.LocalesArgument;
  scale?: boolean;
  duration?: number; // in ms
  ease?: string; // css cubic-bezier
  disabled?: boolean;
  respectReducedMotion?: boolean;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}
