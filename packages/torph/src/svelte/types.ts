import type { TextMorphOptions } from "../lib/text-morph/types";

export interface TextMorphProps extends Omit<TextMorphOptions, "element"> {
  text: string;
  locale?: Intl.LocalesArgument;
  duration?: number;
  ease?: string;
  debug?: boolean;
}

