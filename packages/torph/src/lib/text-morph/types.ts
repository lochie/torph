import type { BaseMorphOptions } from "../utils/types";

export interface TextMorphOptions extends BaseMorphOptions {
  debug?: boolean;
  scale?: boolean;
  onAnimationCancel?: () => void;
}
