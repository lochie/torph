import type { BaseMorphOptions } from "../utils/types";

export interface TextMorphOptions extends BaseMorphOptions {
  debug?: boolean;
  scale?: boolean;
  /** Morph numeric words by place value. Off falls back to the character-level morph. */
  numbers?: boolean;
  /** Fraction digits for a numeric value. Ignored for strings. */
  decimals?: number;
  onAnimationCancel?: () => void;
}
