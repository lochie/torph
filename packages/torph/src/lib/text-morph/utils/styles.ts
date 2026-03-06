import {
  ATTR_ROOT,
  ATTR_ITEM,
  ATTR_DEBUG,
} from "./constants";

const TORPH_CSS = `
[${ATTR_ROOT}] {
  display: inline-flex;
  position: relative;
  will-change: width, height;
  transition-property: width, height;
  white-space: nowrap;
}

[${ATTR_ITEM}] {
  display: inline-block;
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
