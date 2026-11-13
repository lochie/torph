import type { Segment } from "./types";
import { layoutSize, parseTranslate } from "./animate";
import {
  ATTR_EXITING,
  ATTR_ID,
  ATTR_ITEM,
  ATTR_KIND,
  ATTR_SLOT,
  ATTR_SR,
} from "./constants";

/**
 * Where a `left`/`top` write puts the box. Not `getBoundingClientRect`, which is the
 * visual box: a rotated or scaled ancestor inflates it, and the inflated numbers are
 * then read back as layout and transformed a second time. The walk stops at the
 * container when it is positioned, and otherwise carries on to the ancestor an
 * absolute child would resolve against — the same one either way.
 */
function layoutOffset(child: HTMLElement, container: HTMLElement) {
  let x = 0;
  let y = 0;
  for (
    let node: HTMLElement | null = child;
    node && node !== container;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

/** Every element here is a fragment of the value, so all of it is aria-hidden. */
function createItem(tagName: "span" | "br", id: string): HTMLElement {
  const element = document.createElement(tagName);
  element.setAttribute(ATTR_ITEM, "");
  element.setAttribute(ATTR_ID, id);
  element.setAttribute("aria-hidden", "true");
  return element;
}

export function detachFromFlow(
  container: HTMLElement,
  elements: HTMLElement[],
) {
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
    const { x, y } = layoutOffset(child, container);
    // Where the box had got to, so an interrupt does not jump. Scale is dropped with
    // the animation, as it is everywhere else a running transform is picked up.
    const { tx, ty } = parseTranslate(child);
    const { width, height } = layoutSize(child);
    const opacity = Number(getComputedStyle(child).opacity) || 1;
    child.getAnimations().forEach((a) => a.cancel());
    snapshots.set(child, {
      left: x + tx,
      top: y + ty,
      width,
      height,
      opacity,
    });
  }

  // BRs can't be animated, so they leave the flow before reconciliation.
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
      const span = createItem("span", seg.id);
      syncSlot(span, seg);
      child.before(span);
    }
    child.remove();
  }
}

/**
 * Gives a numeric character the nested box its slide needs, and takes it away when
 * it stops being one — both directions have to work on a reused element. The kind
 * goes on the element because an exit outlives the segment that described it.
 */
function syncSlot(element: HTMLElement, segment: Segment) {
  if (!segment.kind) {
    element.removeAttribute(ATTR_KIND);
    element.removeAttribute(ATTR_SLOT);
    // Also discards the inner span, if this element had one.
    if (element.textContent !== segment.string)
      element.textContent = segment.string;
    return;
  }

  element.setAttribute(ATTR_KIND, segment.kind);
  element.setAttribute(ATTR_SLOT, "");

  let inner = element.firstElementChild as HTMLElement | null;
  if (!inner) {
    element.textContent = "";
    inner = document.createElement("span");
    element.appendChild(inner);
  }
  if (inner.textContent !== segment.string) inner.textContent = segment.string;
}

/** The box the slide is applied to — the nested span for a slot, else the element. */
export function moverOf(element: HTMLElement): HTMLElement {
  return element.hasAttribute(ATTR_SLOT)
    ? ((element.firstElementChild as HTMLElement | null) ?? element)
    : element;
}

/** Keep survivors attached and retain their text nodes unless their content changes. */
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
    }
  });

  // Remove stale text nodes left over from disabled-mode textContent updates
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
    }
  });

  let cursor = element.firstElementChild;
  const place = (child: HTMLElement) => {
    while (
      cursor?.hasAttribute(ATTR_SR) ||
      cursor?.hasAttribute(ATTR_EXITING)
    ) {
      cursor = cursor.nextElementSibling;
    }
    if (child === cursor) cursor = cursor.nextElementSibling;
    else element.insertBefore(child, cursor);
  };

  segments.forEach((segment) => {
    // Claimed once only: a shared ID would leave the earlier position empty.
    const existing = reusable.get(segment.id);
    if (existing) reusable.delete(segment.id);
    if (existing && (segment.string === "\n") !== (existing.tagName === "BR")) {
      if (existing === cursor) cursor = existing.nextElementSibling;
      existing.remove();
    }

    if (segment.string === "\n") {
      if (existing && existing.tagName === "BR") {
        place(existing);
      } else {
        place(createItem("br", segment.id));
      }
      return;
    }

    if (existing && existing.tagName !== "BR") {
      // A group replacement leaves a shared origin behind; the next morph would use it.
      existing.style.transformOrigin = "";
      syncSlot(existing, segment);
      place(existing);
    } else {
      const span = createItem("span", segment.id);
      syncSlot(span, segment);
      place(span);
    }
  });
}
