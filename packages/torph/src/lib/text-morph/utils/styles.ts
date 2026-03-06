const TORPH_CSS = `
[torph-root] {
  display: inline-flex;
  position: relative;
  will-change: width, height;
  transition-property: width, height;
  white-space: nowrap;
}

[torph-item] {
  display: inline-block;
  will-change: opacity, transform;
  transform: none;
  opacity: 1;
}

[torph-root][torph-debug] {
  outline: 2px solid magenta;
  [torph-item] {
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
