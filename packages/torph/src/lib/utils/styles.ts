import {
  ATTR_ROOT,
  ATTR_ITEM,
  ATTR_DEBUG,
  ATTR_SLOT,
  ATTR_SR,
  ATTR_TEXT,
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

[${ATTR_TEXT}] {
  white-space: pre;
}

[${ATTR_ITEM}]:not(br) {
  display: inline-block;
  position: relative;
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
  `
[${ATTR_SLOT}] > span {
  display: inline-block;
}
` +
  `
[${ATTR_ROOT}][${ATTR_DEBUG}] {
  outline: 2px solid magenta;
  [${ATTR_ITEM}] {
    outline: 2px solid cyan;
    outline-offset: -4px;
  }
}`;

let styleEl: HTMLStyleElement | null = null;
let refCount = 0;
const included = new Set<string>();

/** One sheet for every instance: the core rules, then each plugin's once. */
export function addStyles(extra: readonly string[] = []) {
  refCount++;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.dataset.torph = "true";
    styleEl.textContent = TORPH_CSS;
    document.head.appendChild(styleEl);
  }
  for (const css of extra) {
    if (included.has(css)) continue;
    included.add(css);
    styleEl.textContent += css;
  }
}

export function removeStyles() {
  refCount--;
  if (refCount > 0 || !styleEl) return;

  styleEl.remove();
  styleEl = null;
  included.clear();
}
