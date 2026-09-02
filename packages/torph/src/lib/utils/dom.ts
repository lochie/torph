import type { Segment } from "./types";
import {
  ATTR_EXITING,
  ATTR_ID,
  ATTR_ITEM,
  ATTR_KIND,
  ATTR_SLOT,
} from "./constants";

/**
 * Every element the engine puts in the root is a fragment of the value rather
 * than the value: a word split to the character, a character mid-exit, a `br`
 * standing in for a newline. None of it reads as the text it draws, so all of
 * it is hidden and the root's `[torph-sr]` node speaks for the whole.
 */
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
      const span = createItem("span", seg.id);
      syncSlot(span, seg);
      child.before(span);
    }
    child.remove();
  }
}

/**
 * Gives a numeric character the nested box its slide needs, and takes it away
 * again when the same character stops being one.
 *
 * The kind is written to the element because an exit outlives the segment that
 * described it — by the time it animates, the element is all that is left.
 *
 * Both directions have to work on an element being reused: a figure that gains
 * a second line becomes text and has to shed its slot, and gets it back when
 * the value returns to one line.
 */
function syncSlot(element: HTMLElement, segment: Segment) {
  if (!segment.kind) {
    element.removeAttribute(ATTR_KIND);
    element.removeAttribute(ATTR_SLOT);
    // Also discards the inner span, if this element had one.
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
  inner.textContent = segment.string;
}

/**
 * The box the slide is applied to. For a slot that is the nested span, so the
 * movement is clipped by the slot around it; for anything else the element is
 * its own mover.
 */
export function moverOf(element: HTMLElement): HTMLElement {
  return element.hasAttribute(ATTR_SLOT)
    ? ((element.firstElementChild as HTMLElement | null) ?? element)
    : element;
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
        element.appendChild(createItem("br", segment.id));
      }
      return;
    }

    if (existing && existing.tagName !== "BR") {
      // A group replacement leaves a shared origin behind on its members. Left
      // there, the next morph would scale this element about a point somewhere
      // else entirely.
      existing.style.transformOrigin = "";
      syncSlot(existing, segment);
      element.appendChild(existing);
    } else {
      const span = createItem("span", segment.id);
      syncSlot(span, segment);
      element.appendChild(span);
    }
  });
}
