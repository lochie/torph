export {
  DEFAULT_AS,
  DEFAULT_TEXT_MORPH_OPTIONS,
  MorphController,
  TextMorph,
} from "./lib/text-morph";
export type { TextMorphOptions } from "./lib/text-morph/types";
export type { SpringParams } from "./lib/utils/spring";
export { segmentText } from "./lib/text-morph/utils/segment";
export type { Segment } from "./lib/text-morph/utils/segment";
export { diffSegments } from "./lib/text-morph/utils/diff";
export type { DiffOptions, DiffResult } from "./lib/text-morph/utils/diff";

export {
  decimalSeparator,
  isNumericWord,
  segmentNumber,
} from "./lib/text-morph/utils/number";
export type { NumberSegment } from "./lib/text-morph/utils/number";
