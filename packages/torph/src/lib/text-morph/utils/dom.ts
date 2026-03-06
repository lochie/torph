import type { Segment } from "./segment";
import { ATTR_EXITING, ATTR_ID, ATTR_ITEM } from "./constants";
import { parseTranslate } from "./animate";

export function detachFromFlow(elements: HTMLElement[]) {
  const snapshots = elements.map((child) => {
    const { tx, ty } = parseTranslate(child);
    const opacity = Number(getComputedStyle(child).opacity) || 1;
    child.getAnimations().forEach((a) => a.cancel());
    return {
      left: child.offsetLeft + tx,
      top: child.offsetTop + ty,
      width: child.offsetWidth,
      height: child.offsetHeight,
      opacity,
    };
  });

  elements.forEach((child, i) => {
    const snap = snapshots[i]!;
    child.setAttribute(ATTR_EXITING, "");
    child.style.position = "absolute";
    child.style.pointerEvents = "none";
    child.style.left = `${snap.left}px`;
    child.style.top = `${snap.top}px`;
    child.style.width = `${snap.width}px`;
    child.style.height = `${snap.height}px`;
    child.style.opacity = String(snap.opacity);
  });
}

export function reconcileChildren(
  element: HTMLElement,
  oldChildren: HTMLElement[],
  newIds: Set<string>,
  segments: Segment[],
) {
  // Build a map of reusable existing elements (non-exiting, persistent)
  const reusable = new Map<string, HTMLElement>();
  oldChildren.forEach((child) => {
    const id = child.getAttribute(ATTR_ID) as string;
    if (newIds.has(id) && !child.hasAttribute(ATTR_EXITING)) {
      reusable.set(id, child);
      child.remove();
    }
  });

  // Remove stale text nodes left over from disabled-mode textContent updates
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
    }
  });

  segments.forEach((segment) => {
    const existing = reusable.get(segment.id);
    if (existing) {
      existing.textContent = segment.string;
      element.appendChild(existing);
    } else {
      const span = document.createElement("span");
      span.setAttribute(ATTR_ITEM, "");
      span.setAttribute(ATTR_ID, segment.id);
      span.textContent = segment.string;
      element.appendChild(span);
    }
  });
}
