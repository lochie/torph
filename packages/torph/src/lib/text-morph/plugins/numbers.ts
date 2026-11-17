import type { Segment } from "../../utils/types";
import { VAR_INK_BOTTOM, VAR_INK_TOP } from "../../utils/constants";
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
  NO_CLIP,
  slotClip,
  type SlotClip,
} from "../utils/number-animate";
import { NUMBERS_CSS } from "./numbers-css";

// An unchanged write would still restyle every slot.
function setStyleVar(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value) {
    element.style.setProperty(name, value);
  }
}

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

const slot: KindSpec<SlotClip> = {
  slot: true,
  enter: animateNumberEnter,
  persist: animateNumberPersist,
  exit: animateNumberExit,
};

const NUMBERS: TorphPlugin<SlotClip> = {
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
  read: (_root, style) => slotClip(style),
  prepare: (root, { inkTop, inkBottom }) => {
    // Only a new font changes these, so most morphs write nothing.
    if (inkTop !== null && inkBottom !== null) {
      setStyleVar(root, VAR_INK_TOP, `${inkTop.toFixed(4)}em`);
      setStyleVar(root, VAR_INK_BOTTOM, `${inkBottom.toFixed(4)}em`);
    }
  },
  teardown: (root) => {
    root.style.removeProperty(VAR_INK_TOP);
    root.style.removeProperty(VAR_INK_BOTTOM);
  },
  css: NUMBERS_CSS,
  idle: NO_CLIP,
  kinds: { digit: slot, symbol: slot },
};

/** Figures morph digit by digit, each digit sliding in its own slot, the way the value went. */
export const numbers = () => NUMBERS;
