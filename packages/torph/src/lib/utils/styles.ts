import {
  ATTR_ROOT,
  ATTR_ITEM,
  ATTR_DEBUG,
  ATTR_SLOT,
  ATTR_SR,
} from "./constants";

const TORPH_CSS = `
[${ATTR_ROOT}] {
  display: inline-block;
  position: relative;
  vertical-align: top;
  will-change: width, height;
  white-space: nowrap;
  text-align: inherit;
}

[${ATTR_ITEM}]:not(br) {
  display: inline-block;
  position: relative;
  will-change: opacity, transform;
  transform: none;
  opacity: 1;
}

/*
 * The value, once, as ordinary text — the only part of the root a screen reader
 * is allowed to see. Everything else in here is a fragment: a word split to the
 * character so its halves can travel apart, or a character on its way out that
 * still has to be in the DOM to animate. Read as text that is a value spelled
 * one letter per box, interleaved with whatever the previous value has not
 * finished leaving behind, so aria-hidden covers the lot and this stands in
 * for it.
 *
 * Out of flow, because the engine measures every child of the root and this one
 * must not be among the things that have a position. Clipped rather than
 * display: none or visibility: hidden, either of which would take it out of
 * the accessibility tree along with everything else.
 *
 * user-select: none keeps it out of a copied selection. It is inside the root
 * and would otherwise be dragged over with the text it duplicates, and paste a
 * second copy of the value.
 */
[${ATTR_SR}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: pre;
  -webkit-user-select: none;
  user-select: none;
}

/*
 * A numeric character slides a whole line box to arrive or leave, so it needs
 * something to disappear behind. That has to be its own box rather than the
 * root: the root spans every line of the value, so clipping there only bounds
 * the first line's top and the last line's bottom, and a digit on any line
 * between them would slide over its neighbour in plain view.
 *
 * The slot's height is the line box, and the transform lives on the child, so
 * the slide never touches the slot's own rect. The FLIP pass measures slots and
 * is oblivious to where the character inside one has got to.
 *
 * clip-path rather than overflow, because overflow would move the slot's
 * baseline. An inline-block whose overflow computes to anything but visible has
 * its baseline synthesized to the bottom margin edge (CSS 2.1 10.8.1), so every
 * digit would hang from its own bottom edge while the words beside it sat on
 * the text baseline, and the taller line box would drag anything measuring the
 * root's height along with it. Whether overflow: clip triggers that rule is
 * read differently by different engines, which is the worst version of it.
 *
 * The inline axis is left open. A digit does not move horizontally inside its
 * slot, so the only thing out there is glyph overhang, and clipping it would
 * shave italics and accents for nothing.
 */
[${ATTR_SLOT}] {
  clip-path: inset(0 -100vw);
}

[${ATTR_SLOT}] > span {
  display: inline-block;
  will-change: opacity, transform;
}

/*
 * Softens the clip above into a gradient, so a character dissolves across the
 * edge of its line box instead of meeting a hard line. Positional rather than
 * timed: how faint it is depends on where it has slid to, which keeps it in
 * step with its own movement at any duration.
 *
 * The band is --torph-fade — set it to 0 for a hard edge. It has to eat
 * into the box, because the clip is what bounds the block axis and it trims at
 * the border box: a gradient reaching past that edge lies in territory the clip
 * has already taken, and the fade is never seen. The cost is that the band also
 * dims anything legitimately sitting in it, so at a tight line-height a
 * descender's tip goes faint.
 *
 * no-clip is why the fallback exists. A mask layer is otherwise clipped to
 * the border box, which would hide any glyph overhanging its slot; repeat-x
 * then carries the same profile across that overhang.
 */
@supports (mask-clip: no-clip) or (-webkit-mask-clip: no-clip) {
  [${ATTR_SLOT}] {
    --torph-mask: linear-gradient(
      to bottom,
      transparent,
      #000 var(--torph-fade, 0.15em),
      #000 calc(100% - var(--torph-fade, 0.15em)),
      transparent
    );
    -webkit-mask-image: var(--torph-mask);
    mask-image: var(--torph-mask);
    -webkit-mask-repeat: repeat-x;
    mask-repeat: repeat-x;
    -webkit-mask-clip: no-clip;
    mask-clip: no-clip;
  }
}

[${ATTR_ROOT}][${ATTR_DEBUG}] {
  outline: 2px solid magenta;
  [${ATTR_ITEM}] {
    outline: 2px solid cyan;
    outline-offset: -4px;
  }
}`;

let styleEl: HTMLStyleElement | null = null;
let refCount = 0;

export function addStyles() {
  refCount++;
  if (styleEl) return;

  styleEl = document.createElement("style");
  styleEl.dataset.torph = "true";
  styleEl.textContent = TORPH_CSS;
  document.head.appendChild(styleEl);
}

export function removeStyles() {
  refCount--;
  if (refCount > 0 || !styleEl) return;

  styleEl.remove();
  styleEl = null;
}
