import type { BaseMorphOptions } from "../utils/types";
import type { AnyPlugin } from "./plugin";

export interface TextMorphOptions extends BaseMorphOptions {
  debug?: boolean;
  /** Fraction digits for a numeric value. Ignored for strings. */
  decimals?: number;
  onAnimationCancel?: () => void;
  /** In order, earlier ones first; set, it replaces torph's own `classic()` set, and `[]` is the engine alone. */
  plugins?: readonly AnyPlugin[];
}
