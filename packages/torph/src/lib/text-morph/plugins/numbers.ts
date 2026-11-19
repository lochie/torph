import type { Segment } from "../../utils/types";
import type { KindSpec, TorphPlugin } from "../plugin";
import {
  classifyKind,
  decimalSeparator,
  hasDigit,
  isNumericWord,
  numericSkeleton,
  segmentNumber,
  type NumberSegment,
} from "../utils/number";
import {
  animateNumberEnter,
  animateNumberExit,
  animateNumberPersist,
} from "../utils/number-animate";

/** Fills in kinds an older segmentation of the same word lacked, or another plugin gave it. */
function asNumberSegments(segments: Segment[]): NumberSegment[] {
  return segments.map((seg) => ({
    ...seg,
    kind:
      seg.kind === "digit" || seg.kind === "symbol"
        ? seg.kind
        : classifyKind(seg.string),
  }));
}

const slot: KindSpec<unknown> = {
  slot: true,
  enter: animateNumberEnter,
  persist: animateNumberPersist,
  exit: animateNumberExit,
};

const NUMBERS: TorphPlugin = {
  name: "numbers",
  touches: hasDigit,
  claim: isNumericWord,
  segment: (word, ctx) =>
    ctx.previous
      ? segmentNumber(
          word,
          asNumberSegments(ctx.split()),
          ctx.cursor,
          decimalSeparator(ctx.locale),
          () => ctx.id(),
        )
      : segmentNumber(word, undefined, undefined, undefined, () => ctx.id()),
  // Numbers share too few characters to pair with each other, so they all collapse to one token.
  token: () => "#",
  // A matching numeric skeleton beats shared characters.
  affinity: (a, b) =>
    (hasDigit(a) || hasDigit(b)) && numericSkeleton(a) === numericSkeleton(b)
      ? 1
      : null,
  kinds: { digit: slot, symbol: slot },
};

/** Figures morph digit by digit, each digit sliding in its own slot, the way the value went. */
export const numbers = () => NUMBERS;
