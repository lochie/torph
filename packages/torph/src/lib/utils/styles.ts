import {
  ATTR_ROOT,
  ATTR_ITEM,
  ATTR_DEBUG,
  ATTR_SLOT,
  ATTR_SR,
  VAR_INK_TOP,
  VAR_INK_BOTTOM,
} from "./constants";

// Comments sit between the strings, not inside them, so the build strips them.
const TORPH_CSS =
  `
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
` +
  /*
   * The value once as plain text — every other child is an aria-hidden fragment.
   * Out of flow, because the engine measures every child of the root. Clipped
   * rather than display: none, which would take it out of the a11y tree as well.
   * user-select: none, or a copied selection pastes the value twice.
   */
  `
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
` +
  /*
   * A digit slides a whole line box to arrive, so it needs its own box to hide
   * behind. Not the root: that spans every line, so clipping there leaves a digit
   * on a middle line sliding over its neighbour in view. The transform sits on the
   * child, so the slide never touches the slot's rect and the FLIP pass stays
   * oblivious. clip-path, not overflow — an inline-block whose overflow is
   * anything but visible has its baseline synthesized to the bottom margin edge
   * (CSS 2.1 §10.8.1), and engines disagree on whether overflow: clip counts.
   * The inline axis stays open so glyph overhang is not shaved.
   *
   * A line shorter than its glyphs would shave a digit at rest, so the box grows
   * past the line to the ink plus the fade band. The engine supplies the ink's
   * reach from the line's centre in em, per font; the line-height is applied here,
   * so changing it needs no morph. 0.6em each way — a 1.2em content area — stands
   * in until the engine has measured. Padding, not a wider clip: the mask only acts
   * inside the border box. The matching negative margin keeps the line box and
   * baseline where they were. Whole pixels where round() exists, because an exit
   * is pinned with offsetTop, which rounds. Not @property: registering a custom
   * property made every morph's restyle about 60% slower in Chrome.
   */
  `
[${ATTR_SLOT}] {
  --torph-top: 0px;
  --torph-bottom: 0px;
  padding-block: var(--torph-top) var(--torph-bottom);
  margin-block: calc(-1 * var(--torph-top)) calc(-1 * var(--torph-bottom));
  clip-path: inset(0 -100vw);
}

@supports (height: 1lh) {
  [${ATTR_SLOT}] {
    --torph-top: max(
      0px,
      var(--torph-fade, 0.15em) + var(${VAR_INK_TOP}, 0.6em) - 0.5lh
    );
    --torph-bottom: max(
      0px,
      var(--torph-fade, 0.15em) + var(${VAR_INK_BOTTOM}, 0.6em) - 0.5lh
    );
  }
}

@supports (height: 1lh) and (width: round(up, 1.5px, 1px)) {
  [${ATTR_SLOT}] {
    padding-block: round(up, var(--torph-top), 1px)
      round(up, var(--torph-bottom), 1px);
    margin-block: calc(-1 * round(up, var(--torph-top), 1px))
      calc(-1 * round(up, var(--torph-bottom), 1px));
  }
}

[${ATTR_SLOT}] > span {
  display: inline-block;
  will-change: opacity, transform;
}
` +
  /*
   * Softens the clip above into a gradient, positionally rather than on a timer, so
   * it stays in step with the slide at any duration. The band (--torph-fade, 0 for a
   * hard edge) must eat into the box: the clip trims at the border box, so a ramp
   * reaching past it sits in territory already removed and is never seen. no-clip
   * plus repeat-x is what carries the profile across glyph overhang.
   */
  `
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
