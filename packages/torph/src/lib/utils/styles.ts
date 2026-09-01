import { ATTR_ROOT, ATTR_ITEM, ATTR_DEBUG, ATTR_SLOT } from "./constants";

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
 * A numeric character slides a whole line box to arrive or leave, so it needs
 * something to disappear behind. That has to be its own box rather than the
 * root: the root spans every line of the value, so clipping there only bounds
 * the first line's top and the last line's bottom, and a digit on any line
 * between them would slide over its neighbour in plain view.
 *
 * The slot's height is the line box, and the transform lives on the child, so
 * the slide never touches the slot's own rect. The FLIP pass measures slots and
 * is oblivious to where the character inside one has got to.
 */
[${ATTR_SLOT}] {
  overflow-x: visible;
  overflow-y: clip;
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
