export interface TextMorphProps {
  text: string;
  locale?: Intl.LocalesArgument;
  duration?: number;
  ease?: string;
  debug?: boolean;
  scale?: boolean;
  disabled?: boolean;
  respectReducedMotion?: boolean;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
  class?: string;
  style?: string;
  as?: string;
}
