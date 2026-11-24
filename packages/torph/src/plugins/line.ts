// For a plugin that times boxes by their line: cascade, and mask's line-by-line cascade.

export type Lines = { lines: WeakMap<Element, number> | null };

/** A box's line: the line breaks before it, counted from the DOM once per morph, not from layout. */
export function lineOf(box: HTMLElement, cache: Lines) {
  if (!cache.lines) {
    cache.lines = new WeakMap();
    let line = 0;
    for (const child of Array.from(box.parentElement?.children ?? [])) {
      if (child.tagName === "BR") line++;
      else cache.lines.set(child, line);
    }
  }
  return cache.lines.get(box) ?? 0;
}
