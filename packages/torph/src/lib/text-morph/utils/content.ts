/**
 * A value is a run of text and elements, not just a string. Elements are atomic:
 * they never split, never pair with a word, and carry their own identity, so the
 * engine treats one as a single-segment word sitting between the text around it.
 *
 * The whole pipeline downstream of here still works on `ContentPart[]`, so a
 * plain string is just the one-part case.
 */

/**
 * The key an element is tracked by, verbatim in its ID. A NULL prefix cannot
 * collide with a text ID (those are derived from the text) and the discriminator
 * keeps it off `mintId()`'s `\u0000n<counter>` for numbers.
 */
export const ELEMENT_PREFIX = "\u0000e";

/** Read off the element itself, so a framework wrapper can hand its own key down. */
export const ATTR_KEY = "data-torph-key";

/** Says an element is formatting whatever its tag — the opposite of `ATTR_KEY`. */
export const ATTR_FORMAT = "data-torph-format";

/**
 * Says an element speaks for itself: it stays in the accessibility tree, and out of
 * the plain-text copy, which would otherwise announce its label a second time.
 */
export const ATTR_INTERACTIVE = "data-torph-interactive";

/** The inline tags a value is flattened *through*, rather than treated as a thing. */
const FORMAT_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "DEL",
  "INS",
  "MARK",
  "SMALL",
  "SUB",
  "SUP",
  "CODE",
]);

/** Carried onto a rebuilt tag. Anything else would be a thing, not formatting. */
export const FORMAT_ATTRS = ["href", "target", "rel", "title"] as const;

/** Ancestors of a run of text, outermost first — the wrapper each run is rendered in. */
export type Format = {
  tag: string;
  className?: string;
  style?: string;
  attrs?: Record<string, string>;
  /** Speaks for its whole run: named by it, and left out of the plain-text copy. */
  interactive?: boolean;
}[];

export type ContentPart =
  | { kind: "text"; value: string; format?: Format }
  | { kind: "element"; id: string; node: Element };

/** Identity of a format, for the comparisons that decide what is one run. */
export function formatKey(format?: Format): string {
  if (!format?.length) return "";
  return format
    .map(
      (f) =>
        `${f.tag}.${f.className ?? ""}|${f.style ?? ""}|${JSON.stringify(
          f.attrs ?? {},
        )}|${f.interactive ? "!" : ""}`,
    )
    .join(">");
}

/** The part a framework wrapper builds for a child it renders itself. */
export function elementPart(key: string, node: Element): ContentPart {
  return { kind: "element", id: ELEMENT_PREFIX + key, node };
}

export function isElementToken(value: string): boolean {
  return value.startsWith(ELEMENT_PREFIX);
}

export function toParts(value: string | ContentPart[]): ContentPart[] {
  return typeof value === "string" ? [{ kind: "text", value }] : value;
}

/**
 * Flattens a source subtree into parts. `<br>` is the newline the engine already
 * models; an inline formatting tag is walked through, carried as a `Format` on the
 * text inside it; anything else is a thing in its own right.
 */
export function flattenContent(source: Element): ContentPart[] {
  const parts: ContentPart[] = [];
  const used = new Set<string>();
  let index = 0;

  const pushText = (value: string, format?: Format) => {
    if (!value) return;
    const last = parts[parts.length - 1];
    if (last?.kind === "text" && formatKey(last.format) === formatKey(format)) {
      last.value += value;
    } else {
      parts.push({ kind: "text", value, format });
    }
  };

  const walk = (parent: Element, format?: Format) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        pushText(node.textContent ?? "", format);
        continue;
      }
      if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;

      const element = node as Element;
      if (element.tagName === "BR") {
        pushText("\n", format);
        continue;
      }

      // A key says the author means this element itself, whatever its tag.
      // An element with no text in it is a thing, whatever its tag — flattening one
      // would leave nothing behind at all.
      const keyed = element.hasAttribute(ATTR_KEY);
      const wrapsText = (element.textContent ?? "") !== "";
      const asFormat =
        element.hasAttribute(ATTR_FORMAT) || FORMAT_TAGS.has(element.tagName);
      if (!keyed && wrapsText && asFormat) {
        const attrs: Record<string, string> = {};
        for (const name of FORMAT_ATTRS) {
          const value = element.getAttribute(name);
          if (value !== null) attrs[name] = value;
        }

        walk(element, [
          ...(format ?? []),
          {
            tag: element.tagName.toLowerCase(),
            className: element.getAttribute("class") ?? undefined,
            style: element.getAttribute("style") ?? undefined,
            attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
            interactive: element.hasAttribute(ATTR_INTERACTIVE) || undefined,
          },
        ]);
        continue;
      }

      const key = element.getAttribute(ATTR_KEY) ?? `#${index}`;
      index++;

      // Two elements sharing a key would fight over one item and one would vanish.
      let id = ELEMENT_PREFIX + key;
      for (let n = 1; used.has(id); n++) id = `${ELEMENT_PREFIX}${key}~${n}`;
      used.add(id);

      parts.push({ kind: "element", id, node: element });
    }
  };

  walk(source);

  return parts;
}

/** What an element contributes to the value read aloud. */
function elementText(node: Element): string {
  if (node.hasAttribute(ATTR_INTERACTIVE)) return "";
  if (node.getAttribute("aria-hidden") === "true") return "";
  return (
    node.getAttribute("aria-label") ??
    node.getAttribute("alt") ??
    node.textContent ??
    ""
  );
}

/** The value once, as plain text — what the `[torph-sr]` node holds. */
export function contentText(parts: ContentPart[]): string {
  return parts
    .map((part) => {
      if (part.kind !== "text") return elementText(part.node);
      // A run that speaks for itself is named by its own wrapper; saying it here too
      // would announce it twice.
      return part.format?.some((step) => step.interactive) ? "" : part.value;
    })
    .join("");
}

/** Identity of a value, so an update that changes nothing does nothing. */
export function contentSignature(parts: ContentPart[]): string {
  return parts
    .map((part) =>
      part.kind === "text"
        ? `${formatKey(part.format)}(${part.value})`
        : part.id,
    )
    .join("");
}

/** The text half only — the part number detection and word splitting run on. */
export function plainText(parts: ContentPart[]): string {
  return parts.map((part) => (part.kind === "text" ? part.value : "")).join("");
}
