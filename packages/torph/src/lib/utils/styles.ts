import { ATTR_ROOT, ATTR_ITEM, ATTR_DEBUG } from "./constants";

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

const MASK_PROPERTIES = [
  "mask-image",
  "mask-repeat",
  "mask-clip",
  "mask-size",
  "mask-position",
] as const;

/**
 * Digits slide vertically past the line box on enter and exit, so the block
 * axis is masked. The inline axis must stay visible: the container spends the
 * whole duration animating to its new width, and clipping it would mask every
 * character sitting beyond the old width until the size transition catches up.
 *
 * `clip` is what makes that split legal — `overflow-x: visible` next to
 * `overflow-y: hidden` computes to `auto`, which would scroll instead.
 */
function clipBlockAxis(element: HTMLElement) {
  if (CSS.supports("overflow", "clip")) {
    element.style.overflowX = "visible";
    element.style.overflowY = "clip";
  } else {
    element.style.overflow = "hidden";
  }
}

/**
 * Softens the block-axis clip into a gradient, so characters dissolve across
 * the edge of the line box instead of meeting a hard line. Positional rather
 * than timed: how faint a character is depends on where it has slid to, which
 * keeps it in step with its own movement at any duration.
 *
 * The band is `--torph-fade` on the root — set it to `0` for a hard edge.
 *
 * The tile is grown past the line box by `--torph-overshoot` so the fade
 * begins *outside* it. Digits never needed that, but this root now holds
 * arbitrary text: at a tight `line-height` a descender or a diacritic overflows
 * the line box, and a band flush with the edge would ghost the tail of every
 * "g" in the sentence.
 *
 * `no-clip` is load-bearing. A mask layer is otherwise clipped to the border
 * box, which would hide every character sitting beyond the container's
 * animating width — exactly what the visible inline axis exists to show.
 * `repeat-x` then carries the same profile across that overflow, while the
 * block axis stays a single tile so anything above or below the box is masked
 * out. Without `no-clip` the mask would cost more than it gives, so the hard
 * clip stands in.
 */
export function applyBlockFade(element: HTMLElement) {
  clipBlockAxis(element);

  if (
    !CSS.supports("mask-clip", "no-clip") &&
    !CSS.supports("-webkit-mask-clip", "no-clip")
  ) {
    return;
  }

  const fade = "var(--torph-fade, 0.15em)";
  const overshoot = "var(--torph-overshoot, 0.25em)";

  setMaskProperty(
    element,
    "mask-image",
    `linear-gradient(to bottom, transparent, #000 ${fade}, #000 calc(100% - ${fade}), transparent)`,
  );
  setMaskProperty(element, "mask-repeat", "repeat-x");
  setMaskProperty(element, "mask-clip", "no-clip");
  setMaskProperty(element, "mask-size", `100% calc(100% + 2 * ${overshoot})`);
  setMaskProperty(element, "mask-position", "center");
}

export function clearBlockFade(element: HTMLElement) {
  element.style.overflow = "";
  element.style.overflowX = "";
  element.style.overflowY = "";
  MASK_PROPERTIES.forEach((property) => {
    element.style.removeProperty(property);
    element.style.removeProperty(`-webkit-${property}`);
  });
}

function setMaskProperty(element: HTMLElement, property: string, value: string) {
  element.style.setProperty(property, value);
  element.style.setProperty(`-webkit-${property}`, value);
}
