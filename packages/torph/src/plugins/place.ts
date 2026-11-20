// Shared by the plugins that work outward from the change: ripple and vortex.

export type Place = {
  /** Where the old and new text first differ. */
  start: number;
  /** Each box's place in the new text, counted once per morph. */
  at: WeakMap<Element, number> | null;
  length: number;
};

export const readPlace = (from: string, to: string): Place => {
  let start = 0;
  while (start < from.length && from[start] === to[start]) start++;
  return { start, at: null, length: to.length };
};

export const idlePlace = (): Place => ({ start: 0, at: null, length: 0 });

/** A box's place in the new text, from text rather than layout, so it's safe mid-morph. */
export function placeOf(box: HTMLElement, place: Place) {
  if (!place.at) {
    place.at = new WeakMap();
    let at = 0;
    const root = box.closest("[torph-root]") ?? box.parentElement!;
    for (const each of Array.from(
      root.querySelectorAll("[torph-id]:not([torph-exiting])"),
    )) {
      place.at.set(each, at);
      at += each.textContent?.length ?? 0;
    }
  }
  return place.at.get(box) ?? place.start;
}
