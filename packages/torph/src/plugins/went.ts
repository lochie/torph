// For a plugin whose motion follows the value: mask's "auto", and sharedAxis.

const FIGURE = /-?\d[\d,]*(?:\.\d+)?/;

/** Which way the first figure in the text went, or null when there's none to compare. */
export function went(from: string, to: string): "up" | "down" | null {
  const [a, b] = [from, to].map((text) => {
    const found = FIGURE.exec(text)?.[0];
    return found ? Number(found.replace(/,/g, "")) : NaN;
  });
  if (Number.isNaN(a) || Number.isNaN(b) || a === b) return null;
  return b! > a! ? "up" : "down";
}
