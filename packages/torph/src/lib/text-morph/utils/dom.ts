import type { Segment } from "./segment";
import { ATTR_EXITING, ATTR_ID, ATTR_ITEM } from "./constants";
import { parseTranslate } from "./animate";

export function detachFromFlow(elements: HTMLElement[]) {
  const positions = elements.map((child) => {
    const { tx, ty } = parseTranslate(child);
    child.getAnimations().forEach((a) => a.cancel());
    return {
      left: child.offsetLeft + tx,
      top: child.offsetTop + ty,
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
  segments: Segment[],
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

  segments.forEach((segment) => {
    const span = document.createElement("span");
    span.setAttribute(ATTR_ITEM, "");
    span.setAttribute(ATTR_ID, segment.id);
    span.textContent = segment.string;
    element.appendChild(span);
  });
}
