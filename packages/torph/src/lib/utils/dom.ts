import type { Segment } from "./types";
import {
  ATTR_INTERACTIVE,
  type Format,
  formatKey,
} from "../text-morph/utils/content";
import { itemsOf } from "./flip";
import {
  ATTR_EXITING,
  ATTR_FORMATTED,
  ATTR_GROUP,
  ATTR_ID,
  ATTR_ITEM,
  ATTR_KIND,
  ATTR_NODE,
  ATTR_SLOT,
  ATTR_SR,
} from "./constants";

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

  // BRs can't be animated, so they leave the flow before reconciliation.
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i]!.tagName === "BR") {
      elements[i]!.remove();
      elements.splice(i, 1);
    }
  }

  elements.forEach((child) => {
    const snap = snapshots.get(child)!;
    // On its way out and no longer reachable — by pointer, by tab, or by a reader.
    child.setAttribute("aria-hidden", "true");
    child.setAttribute("inert", "");
    // Out of whatever run it was in: that wrapper is rebuilt on every morph, and
    // would take the exit down with it. The offsets below are the root's either way.
    container.appendChild(child);
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

  const children = itemsOf(element);
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
 * Rebuilds a segment's inline tags around its text. The chain is disposable — the
 * item it sits in is what FLIP tracks, so replacing the inside of one costs nothing.
 */

/** What an item that changed run should animate its colour away from. */
export type FormatChange = { element: HTMLElement; from: string };

/**
 * The wrapper chain a run is rendered in. `inner` is the box its items go into;
 * `speaks` is the outermost wrapper standing in for the whole run, which cannot be
 * named until the run has been filled.
 */
function openGroup(
  root: HTMLElement,
  format: Format,
): { inner: HTMLElement; speaks: HTMLElement | null } {
  let inner: HTMLElement | null = null;
  let speaks: HTMLElement | null = null;

  for (const step of format) {
    const wrapper = document.createElement(step.tag);
    if (step.className) wrapper.setAttribute("class", step.className);
    if (step.style) wrapper.setAttribute("style", step.style);
    for (const [name, value] of Object.entries(step.attrs ?? {})) {
      wrapper.setAttribute(name, value);
    }
    if (step.interactive && !speaks) speaks = wrapper;
    if (inner) inner.appendChild(wrapper);
    else {
      wrapper.setAttribute(ATTR_GROUP, "");
      root.appendChild(wrapper);
    }
    inner = wrapper;
  }

  return { inner: inner!, speaks };
}

/**
 * Gives a numeric character the nested box its slide needs, and takes it away when
 * it stops being one — both directions have to work on a reused element. The kind
 * goes on the element because an exit outlives the segment that described it.
 */
function syncSlot(element: HTMLElement, segment: Segment) {
  if (segment.node) {
    element.setAttribute(ATTR_NODE, "");
    element.removeAttribute(ATTR_KIND);
    element.removeAttribute(ATTR_SLOT);
    // Hidden by default like every fragment, unless the element says it speaks.
    if (segment.node.hasAttribute(ATTR_INTERACTIVE)) {
      element.removeAttribute("aria-hidden");
    } else {
      element.setAttribute("aria-hidden", "true");
    }
    // Reparenting is what places it; a node already in place is left alone, so a
    // framework rendering into it (and anything animating inside) is undisturbed.
    if (
      element.firstChild !== segment.node ||
      element.childNodes.length !== 1
    ) {
      element.replaceChildren(segment.node);
    }
    return;
  }

  if (!segment.kind) {
    element.removeAttribute(ATTR_NODE);
    element.removeAttribute(ATTR_KIND);
    element.removeAttribute(ATTR_SLOT);
    // Also discards the inner span, if this element had one.
    element.textContent = segment.string;
    return;
  }

  element.removeAttribute(ATTR_NODE);
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

/** The box the slide is applied to — the nested span for a slot, else the element. */
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
): FormatChange[] {
  const nextKey = new Map<string, string>();
  for (const segment of segments) {
    nextKey.set(segment.id, formatKey(segment.format));
  }

  const changes: FormatChange[] = [];
  const reusable = new Map<string, HTMLElement>();
  oldChildren.forEach((child) => {
    const id = child.getAttribute(ATTR_ID) as string;
    if (newIds.has(id) && !child.hasAttribute(ATTR_EXITING)) {
      // Read while it is still in the document — a detached element computes nothing.
      const had = child.getAttribute(ATTR_FORMATTED) ?? "";
      if (had !== (nextKey.get(id) ?? "")) {
        changes.push({ element: child, from: getComputedStyle(child).color });
      }
      reusable.set(id, child);
      child.remove();
    }
  });

  // Every item has been claimed or moved out, so the old runs are empty shells.
  element
    .querySelectorAll(`[${ATTR_GROUP}]`)
    .forEach((group) => group.remove());

  // Anything the engine did not put here goes: text left by a disabled-mode write,
  // and the markup a server rendered for the first paint. Only items, the runs
  // holding them, and the accessible copy are its own.
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as HTMLElement;
    if (
      child.hasAttribute(ATTR_ITEM) ||
      child.hasAttribute(ATTR_GROUP) ||
      child.hasAttribute(ATTR_SR)
    ) {
      return;
    }
    child.remove();
  });

  let host: HTMLElement = element;
  let hostKey = "";
  // A run that speaks for itself is named by what it holds, so the name is written
  // once the run is closed rather than when it opens.
  let speaks: HTMLElement | null = null;
  let spoken = "";

  const closeRun = () => {
    // The engine's spaces are non-breaking; a name read aloud should not be.
    if (speaks) {
      speaks.setAttribute("aria-label", spoken.replace(/\u00A0/g, " ").trim());
    }
    speaks = null;
    spoken = "";
  };

  segments.forEach((segment) => {
    // Claimed once only: a shared ID would leave the earlier position empty.
    const existing = reusable.get(segment.id);
    if (existing) reusable.delete(segment.id);

    // Consecutive segments sharing a format are one run, in one real wrapper.
    const key = formatKey(segment.format);
    if (key !== hostKey) {
      closeRun();
      if (key) {
        const group = openGroup(element, segment.format!);
        host = group.inner;
        speaks = group.speaks;
      } else {
        host = element;
      }
      hostKey = key;
    }
    if (speaks) spoken += segment.string === "\n" ? " " : segment.string;

    if (segment.string === "\n") {
      if (existing && existing.tagName === "BR") {
        host.appendChild(existing);
      } else {
        host.appendChild(createItem("br", segment.id));
      }
      return;
    }

    if (existing && existing.tagName !== "BR") {
      // A group replacement leaves a shared origin behind; the next morph would use it.
      existing.style.transformOrigin = "";
      syncSlot(existing, segment);
      existing.setAttribute(ATTR_FORMATTED, key);
      host.appendChild(existing);
    } else {
      const span = createItem("span", segment.id);
      syncSlot(span, segment);
      span.setAttribute(ATTR_FORMATTED, key);
      host.appendChild(span);
    }
  });

  closeRun();

  return changes;
}
