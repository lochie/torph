import type { TextMorphOptions } from "../lib/text-morph/types";

export interface TextMorphProps extends Omit<TextMorphOptions, "element"> {
  text: string;
  class?: string;
  style?: string;
  as?: string;
}
