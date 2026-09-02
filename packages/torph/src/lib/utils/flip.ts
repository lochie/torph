import { ATTR_EXITING, ATTR_ID, ATTR_SR } from "./constants";
import { parseTranslate } from "./animate";

export type Measures = {
  [key: string]: { x: number; y: number };
};

export function measure(element: HTMLElement): Measures {
  const children = Array.from(element.children) as HTMLElement[];
  const measures: Measures = {};
  const rootRect = element.getBoundingClientRect();

  children.forEach((child, index) => {
    if (child.hasAttribute(ATTR_EXITING)) return;
    if (child.hasAttribute(ATTR_SR)) return;
    if (child.tagName === "BR") return;
    const key = child.getAttribute(ATTR_ID) || `child-${index}`;
    const rect = child.getBoundingClientRect();
    const { tx, ty } = parseTranslate(child);
    measures[key] = {
      // Keep layout-space measurement in subpixels by removing the current
      // transform from the visual rect instead of relying on rounded offsets.
      x: rect.left - rootRect.left - tx,
      y: rect.top - rootRect.top - ty,
    };
  });

  return measures;
}

export function computeDelta(
  prev: Measures,
  current: Measures,
  key: string,
): { dx: number; dy: number } {
  const p = prev[key];
  const c = current[key];
  if (!p || !c) return { dx: 0, dy: 0 };
  return { dx: p.x - c.x, dy: p.y - c.y };
}

/**
 * Finds the nearest persistent neighbor in a list of IDs.
 * Searches backward first by default, then forward.
 */
export function findNearestAnchor(
  targetIndex: number,
  ids: string[],
  persistentIds: Set<string>,
  direction: "backward-first" | "forward-first" = "backward-first",
): string | null {
  const [firstDir, secondDir] =
    direction === "backward-first"
      ? (["backward", "forward"] as const)
      : (["forward", "backward"] as const);

  const search = (dir: "backward" | "forward"): string | null => {
    if (dir === "backward") {
      for (let j = targetIndex - 1; j >= 0; j--) {
        if (persistentIds.has(ids[j]!)) return ids[j]!;
      }
    } else {
      for (let j = targetIndex + 1; j < ids.length; j++) {
        if (persistentIds.has(ids[j]!)) return ids[j]!;
      }
    }
    return null;
  };

  return search(firstDir) ?? search(secondDir);
}

export function resolveExitingAnchors(
  oldChildren: HTMLElement[],
  exiting: Set<HTMLElement>,
  oldIds: string[],
  newIds: Set<string>,
): Map<HTMLElement, string | null> {
  const persistentOldIds = new Set(
    oldIds.filter((id, i) => newIds.has(id) && !exiting.has(oldChildren[i]!)),
  );

  const anchors = new Map<HTMLElement, string | null>();
  for (let i = 0; i < oldChildren.length; i++) {
    const child = oldChildren[i]!;
    if (!exiting.has(child)) continue;
    anchors.set(
      child,
      findNearestAnchor(i, oldIds, persistentOldIds, "forward-first"),
    );
  }

  return anchors;
}
