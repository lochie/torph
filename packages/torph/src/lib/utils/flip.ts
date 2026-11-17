import { ATTR_EXITING, ATTR_ID, ATTR_SR, ATTR_TEXT } from "./constants";
import { parseTranslate } from "./animate";

export type Measures = {
  [key: string]: { x: number; y: number };
};

/** The root's layout axes on screen: x lands at (a, b), y at (c, d), per layout pixel. */
export type Frame = { a: number; b: number; c: number; d: number };

const IDENTITY: Frame = { a: 1, b: 0, c: 0, d: 1 };

const near = (value: number, to: number) => Math.abs(value - to) < 1e-4;

export type Placed = { x: number; y: number; w: number; h: number };

/**
 * A screen rect back in the root's own pixels, where a width or a translate means what it
 * says. A bounding box's centre is its box's centre carried across; its size is the box's
 * size through the absolute map, so that much can be solved back. Null past 45°, where it can't.
 */
export function placer(frame?: Frame): ((rect: DOMRect) => Placed) | null {
  const { a, b, c, d } = frame ?? IDENTITY;
  if (near(a, 1) && near(b, 0) && near(c, 0) && near(d, 1))
    return (rect) => ({
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    });
  const det = a * d - b * c;
  const spread = Math.abs(a) * Math.abs(d) - Math.abs(b) * Math.abs(c);
  if (near(det, 0) || near(spread, 0)) return null;
  return (rect) => {
    const w = (Math.abs(d) * rect.width - Math.abs(c) * rect.height) / spread;
    const h = (Math.abs(a) * rect.height - Math.abs(b) * rect.width) / spread;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return {
      x: (d * x - c * y) / det - w / 2,
      y: (a * y - b * x) / det - h / 2,
      w,
      h,
    };
  };
}

export function measure(element: HTMLElement, frame?: Frame): Measures {
  const children = Array.from(element.children) as HTMLElement[];
  const measures: Measures = {};
  // No layout to read a transform from (display: none, happy-dom) reads as on screen.
  const place = placer(frame) ?? placer()!;
  const root = place(element.getBoundingClientRect());

  children.forEach((child, index) => {
    if (child.hasAttribute(ATTR_EXITING)) return;
    if (child.hasAttribute(ATTR_SR) || child.hasAttribute(ATTR_TEXT)) return;
    if (child.tagName === "BR") return;
    const key = child.getAttribute(ATTR_ID) || `child-${index}`;
    const at = place(child.getBoundingClientRect());
    const { tx, ty } = parseTranslate(child);
    measures[key] = {
      // Subtracting the transform keeps this subpixel, where offsets would round.
      x: at.x - root.x - tx,
      y: at.y - root.y - ty,
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

/** Nearest persisting neighbour by ID, searching backward first, then forward. */
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
