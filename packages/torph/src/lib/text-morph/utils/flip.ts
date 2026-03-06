export type Measures = {
  [key: string]: { x: number; y: number };
};

export function measure(element: HTMLElement): Measures {
  const children = Array.from(element.children) as HTMLElement[];
  const measures: Measures = {};

  children.forEach((child, index) => {
    if (child.hasAttribute("torph-exiting")) return;
    const key = child.getAttribute("torph-id") || `child-${index}`;
    measures[key] = {
      x: child.offsetLeft,
      y: child.offsetTop,
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
