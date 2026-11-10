/** Asks the page whatever it needs, then hands back the writes that follow from it. */
type Read = () => (() => void) | void;

const waiting = new Map<Element, Read>();
let observer: ResizeObserver | null = null;

// Every read of a delivery before any of its writes, or the second read lays out again.
function deliver(entries: ResizeObserverEntry[]) {
  const reads: Read[] = [];
  for (const { target } of entries) {
    const read = waiting.get(target);
    if (!read) continue;
    waiting.delete(target);
    observer!.unobserve(target);
    reads.push(read);
  }

  const writes = reads.map((read) => read());
  for (const write of writes) write?.();
}

/** A ResizeObserver delivers after the frame's layout and before paint, where a read forces nothing. */
export function afterLayout(target: Element, read: Read): () => void {
  observer ??= new ResizeObserver(deliver);
  waiting.set(target, read);
  observer.observe(target);

  return () => {
    waiting.delete(target);
    observer?.unobserve(target);
  };
}
