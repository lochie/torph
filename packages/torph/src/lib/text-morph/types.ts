import type { BaseMorphOptions } from "../utils/types";
import type { AnyPlugin } from "./plugin";

export interface TextMorphOptions extends BaseMorphOptions {
  debug?: boolean;
  scale?: boolean;
  /** Morph numeric words by place value. Off falls back to the character-level morph. */
  numbers?: boolean;
  /** Fraction digits for a numeric value. Ignored for strings. */
  decimals?: number;
  onAnimationCancel?: () => void;
  /** Run before the built-ins, so they can claim words and override motion first. */
  plugins?: readonly AnyPlugin[];
}
