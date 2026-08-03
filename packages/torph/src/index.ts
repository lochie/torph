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
export type { DiffResult } from "./lib/text-morph/utils/diff";

export { DEFAULT_NUMBER_MORPH_OPTIONS, NumberMorph } from "./lib/number-morph";
export type { NumberMorphOptions } from "./lib/number-morph/types";
