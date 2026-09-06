export {
  DEFAULT_AS,
  DEFAULT_TEXT_MORPH_OPTIONS,
  MorphController,
  TextMorph,
} from "./lib/text-morph";
export type { TextMorphOptions } from "./lib/text-morph/types";
export type { SpringParams } from "./lib/utils/spring";
export { segmentContent, segmentText } from "./lib/text-morph/utils/segment";
export type { Segment } from "./lib/text-morph/utils/segment";
export {
  ATTR_FORMAT,
  ATTR_INTERACTIVE,
  ATTR_KEY,
  elementPart,
  flattenContent,
  formatKey,
} from "./lib/text-morph/utils/content";
export { FORMAT_ATTRS } from "./lib/text-morph/utils/content";
export type { ContentPart, Format } from "./lib/text-morph/utils/content";
export { diffSegments } from "./lib/text-morph/utils/diff";
export type { DiffOptions, DiffResult } from "./lib/text-morph/utils/diff";

export {
  decimalSeparator,
  isNumericWord,
  segmentNumber,
} from "./lib/text-morph/utils/number";
export type { NumberSegment } from "./lib/text-morph/utils/number";
