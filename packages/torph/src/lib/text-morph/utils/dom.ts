import type { Block } from "./segment";
import { ATTR_EXITING, ATTR_ID, ATTR_ITEM } from "./constants";

export function detachFromFlow(elements: HTMLElement[]) {
  const positions = elements.map((child) => {
    child.getAnimations().forEach((a) => a.cancel());
    return {
      left: child.offsetLeft,
      top: child.offsetTop,
      width: child.offsetWidth,
      height: child.offsetHeight,
    };
  });

  elements.forEach((child, i) => {
    const pos = positions[i]!;
    child.setAttribute(ATTR_EXITING, "");
    child.style.position = "absolute";
    child.style.pointerEvents = "none";
    child.style.left = `${pos.left}px`;
    child.style.top = `${pos.top}px`;
    child.style.width = `${pos.width}px`;
    child.style.height = `${pos.height}px`;
  });
}

export function reconcileChildren(
  element: HTMLElement,
  oldChildren: HTMLElement[],
  newIds: Set<string>,
  blocks: Block[],
) {
  oldChildren.forEach((child) => {
    const id = child.getAttribute(ATTR_ID) as string;
    if (newIds.has(id)) child.remove();
  });

  // Remove stale text nodes left over from disabled-mode textContent updates
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
    }
  });

  blocks.forEach((block) => {
    const span = document.createElement("span");
    span.setAttribute(ATTR_ITEM, "");
    span.setAttribute(ATTR_ID, block.id);
    span.textContent = block.string;
    element.appendChild(span);
  });
}
