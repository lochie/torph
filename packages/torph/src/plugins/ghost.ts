// For a plugin that draws copies of a box beside it, as shatter does.

/**
 * A copy of `box` laid over it, out of the engine's sight: no torph attributes, before the box
 * with no offsets so it sits where the box starts, unless the box already carries its own
 * (a leaving box does). Gone when the next morph aborts `signal`, or the caller removes it.
 */
export function ghost(box: HTMLElement, signal: AbortSignal) {
  const copy = box.cloneNode(true) as HTMLElement;
  for (const { name } of Array.from(copy.attributes))
    if (name.startsWith("torph-")) copy.removeAttribute(name);
  copy.setAttribute("aria-hidden", "true");
  copy.style.position = "absolute";
  copy.style.pointerEvents = "none";
  box.before(copy);
  signal.addEventListener("abort", () => copy.remove(), { once: true });
  return copy;
}

/** Removes `copy` once `animation` is done, however it ends. */
export const removeAfter = (copy: HTMLElement, animation: Animation) => {
  const remove = () => copy.remove();
  animation.finished.then(remove, remove);
  return animation;
};
