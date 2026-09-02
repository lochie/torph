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
 * The value once as plain text — every other child is an aria-hidden fragment.
 * Out of flow, because the engine measures every child of the root. Clipped
 * rather than display: none, which would take it out of the a11y tree as well.
 * user-select: none, or a copied selection pastes the value twice.
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
 * A digit slides a whole line box to arrive, so it needs its own box to hide
 * behind. Not the root: that spans every line, so clipping there leaves a digit
 * on a middle line sliding over its neighbour in view. The transform sits on the
 * child, so the slide never touches the slot's rect and the FLIP pass stays
 * oblivious. clip-path, not overflow — an inline-block whose overflow is
 * anything but visible has its baseline synthesized to the bottom margin edge
 * (CSS 2.1 §10.8.1), and engines disagree on whether overflow: clip counts.
 * The inline axis stays open so glyph overhang is not shaved.
 */
[${ATTR_SLOT}] {
  clip-path: inset(0 -100vw);
}

[${ATTR_SLOT}] > span {
  display: inline-block;
  will-change: opacity, transform;
}

/*
 * Softens the clip above into a gradient, positionally rather than on a timer, so
 * it stays in step with the slide at any duration. The band (--torph-fade, 0 for a
 * hard edge) must eat into the box: the clip trims at the border box, so a ramp
 * reaching past it sits in territory already removed and is never seen. no-clip
 * plus repeat-x is what carries the profile across glyph overhang.
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
