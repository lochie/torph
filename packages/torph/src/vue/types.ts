import type { TextMorphOptions } from "../lib/text-morph/types";

export interface TextMorphProps extends Omit<TextMorphOptions, "element"> {
  text: string;
}

