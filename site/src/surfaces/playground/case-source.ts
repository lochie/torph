// Extracted from the real file rather than `verify.toString()`, which returns
// transpiled output in dev and minified output in production.

function skipQuoted(src: string, i: number, quote: string): number {
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i + 1;
    i++;
  }
  return i;
}

function skipTemplate(src: string, i: number): number {
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === "`") return i + 1;
    if (src[i] === "$" && src[i + 1] === "{") {
      i = skipBraced(src, i + 1);
      continue;
    }
    i++;
  }
  return i;
}

/** From an opening `{`, returns the index just past its match. */
function skipBraced(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipQuoted(src, i, c);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(src, i);
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      i++;
      if (depth === 0) return i;
      continue;
    }
    i++;
  }
  return -1;
}

function dedent(block: string): string {
  const lines = block.split("\n");
  const rest = lines.slice(1).filter((l) => l.trim().length > 0);
  if (rest.length === 0) return block;
  const indent = Math.min(
    ...rest.map((l) => l.length - l.trimStart().length),
  );
  return [
    lines[0]!,
    ...lines.slice(1).map((l) => (l.trim() ? l.slice(indent) : l)),
  ].join("\n");
}

export function extractCaseSources(source: string): Record<string, string> {
  const out: Record<string, string> = {};

  const declaration = source.indexOf("export const CASES");
  if (declaration === -1) return out;
  // Anchor past the `=` — the type annotation (`TestCase[]`) has brackets too.
  const assign = source.indexOf("=", declaration);
  if (assign === -1) return out;
  const arrayStart = source.indexOf("[", assign);
  if (arrayStart === -1) return out;

  let i = arrayStart + 1;
  while (i < source.length) {
    const c = source[i]!;

    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
        i++;
      i += 2;
      continue;
    }
    if (c === "]") break;

    if (c === "{") {
      const end = skipBraced(source, i);
      if (end === -1) break;
      const block = source.slice(i, end);
      const label = block.match(/label:\s*"((?:[^"\\]|\\.)*)"/);
      if (label) {
        try {
          out[JSON.parse(`"${label[1]}"`) as string] = dedent(block);
        } catch {
          out[label[1]!] = dedent(block);
        }
      }
      i = end;
      continue;
    }

    i++;
  }

  return out;
}
