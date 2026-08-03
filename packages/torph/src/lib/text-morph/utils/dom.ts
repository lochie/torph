import type { Segment } from "./segment";
import { ATTR_EXITING, ATTR_ID, ATTR_ITEM } from "./constants";

export function detachFromFlow(
  container: HTMLElement,
  elements: HTMLElement[],
) {
  const containerRect = container.getBoundingClientRect();
  const snapshots = new Map<
    HTMLElement,
    {
      left: number;
      top: number;
      width: number;
      height: number;
      opacity: number;
    }
  >();
  for (const child of elements) {
    if (child.tagName === "BR") continue;
    const rect = child.getBoundingClientRect();
    const opacity = Number(getComputedStyle(child).opacity) || 1;
    child.getAnimations().forEach((a) => a.cancel());
    snapshots.set(child, {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
      opacity,
    });
  }

  // Remove BR elements — they can't be animated and must leave the flow
  // before reconciliation to prevent layout jumps.
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i]!.tagName === "BR") {
      elements[i]!.remove();
      elements.splice(i, 1);
    }
  }

  elements.forEach((child) => {
    const snap = snapshots.get(child)!;
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

export function splitWordSpans(
  element: HTMLElement,
  splits: Map<string, Segment[]>,
) {
  if (splits.size === 0) return;

  const children = Array.from(element.children) as HTMLElement[];
  const split = new Set<string>();

  for (const child of children) {
    if (child.hasAttribute(ATTR_EXITING)) continue;
    const id = child.getAttribute(ATTR_ID);
    if (!id || split.has(id)) continue;
    const charSegs = splits.get(id);
    if (!charSegs) continue;
    split.add(id);

    for (const seg of charSegs) {
      const span = document.createElement("span");
      span.setAttribute(ATTR_ITEM, "");
      span.setAttribute(ATTR_ID, seg.id);
      span.textContent = seg.string;
      child.before(span);
    }
    child.remove();
  }
}

export function reconcileChildren(
  element: HTMLElement,
  oldChildren: HTMLElement[],
  newIds: Set<string>,
  segments: Segment[],
) {
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
    // Claimed once only: two segments sharing an ID would both append the same
    // node, leaving the earlier position empty.
    const existing = reusable.get(segment.id);
    if (existing) reusable.delete(segment.id);

    if (segment.string === "\n") {
      if (existing && existing.tagName === "BR") {
        element.appendChild(existing);
      } else {
        const br = document.createElement("br");
        br.setAttribute(ATTR_ITEM, "");
        br.setAttribute(ATTR_ID, segment.id);
        element.appendChild(br);
      }
      return;
    }

    if (existing && existing.tagName !== "BR") {
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
