"use client";

import React from "react";
import { createPortal } from "react-dom";
import { DEFAULT_AS } from "../lib/text-morph";
import { MorphController } from "../lib/text-morph/controller";
import type { TextMorphOptions } from "../lib/text-morph/types";
import {
  ATTR_FORMAT,
  ATTR_INTERACTIVE,
  ATTR_KEY,
  type ContentPart,
  FORMAT_ATTRS,
  type Format,
  elementPart,
  formatKey,
} from "../lib/text-morph/utils/content";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: React.ReactNode;
  /** Caret position for a single-number value: place matching becomes caret matching. */
  cursorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

const SEP = "\u0000";

type Piece =
  | { kind: "text"; value: string; format?: Format }
  | {
      kind: "element";
      key: string;
      node: React.ReactNode;
      interactive: boolean;
    };

/** Walked through and carried as a format, rather than treated as a thing. */
const FORMAT_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "small",
  "sub",
  "sup",
  "code",
]);

/** React writes `style` as an object; the rebuilt tag needs the declaration. */
function styleString(style?: React.CSSProperties): string | undefined {
  if (!style) return undefined;
  return Object.entries(style)
    .map(([property, value]) => {
      const name = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return `${name}:${typeof value === "number" ? `${value}px` : value}`;
    })
    .join(";");
}

/** A formatting tag only as far as it wraps text — anything else is its own thing. */
function formatStep(child: React.ReactElement): Format[number] | null {
  if (typeof child.type !== "string") return null;

  const {
    children,
    className,
    style,
    [ATTR_FORMAT]: marked,
    [ATTR_INTERACTIVE]: speaks,
    ...rest
  } = child.props as {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    [ATTR_FORMAT]?: unknown;
    [ATTR_INTERACTIVE]?: unknown;
  };
  if (marked === undefined && !FORMAT_TAGS.has(child.type)) return null;

  const attrs: Record<string, string> = {};
  for (const name of FORMAT_ATTRS) {
    const value = rest[name as keyof typeof rest];
    if (typeof value === "string") {
      attrs[name] = value;
      delete rest[name as keyof typeof rest];
    }
  }

  // Anything else on it — a handler, an id, a ref — is dropped by the rebuild, so
  // an element carrying one stays a thing rather than losing it silently.
  if (Object.keys(rest).length > 0) return null;
  if (!wrapsText(children)) return null;

  return {
    tag: child.type,
    className,
    style: styleString(style),
    attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    interactive: speaks === undefined ? undefined : true,
  };
}

/** Text somewhere inside, and nothing but text and more formatting around it. */
function wrapsText(children: React.ReactNode): boolean {
  const kids = React.Children.toArray(children);
  if (kids.length === 0) return false;

  let text = false;
  for (const child of kids) {
    if (typeof child === "string" || typeof child === "number") {
      text = true;
    } else if (React.isValidElement(child) && child.type === "br") {
      continue;
    } else if (React.isValidElement(child) && formatStep(child) !== null) {
      text = true;
    } else {
      return false;
    }
  }

  return text;
}

/**
 * Children, flattened to the run of text and elements the engine morphs. An
 * element child is atomic — it enters, exits and travels as one thing — and is
 * tracked by its React key, so `<Icon key={state} />` swaps for the next one
 * while `key="avatar"` stays put and the words rearrange around it.
 */
function toPieces(children: React.ReactNode): Piece[] {
  const pieces: Piece[] = [];

  const pushText = (value: string, format?: Format) => {
    if (!value) return;
    const last = pieces[pieces.length - 1];
    if (last?.kind === "text" && formatKey(last.format) === formatKey(format)) {
      last.value += value;
    } else {
      pieces.push({ kind: "text", value, format });
    }
  };

  // `toArray` is what gives every child a key, including those written without one.
  const collect = (children: React.ReactNode, format?: Format) => {
    for (const child of React.Children.toArray(children)) {
      if (typeof child === "string") pushText(child, format);
      else if (typeof child === "number") pushText(String(child), format);
      else if (React.isValidElement(child)) {
        if (child.type === "br") {
          pushText("\n", format);
          continue;
        }
        const step = formatStep(child);
        if (step) {
          const props = child.props as { children?: React.ReactNode };
          collect(props.children, [...(format ?? []), step]);
          continue;
        }
        pieces.push({
          kind: "element",
          key: String(child.key),
          node: child,
          // Read off the child, but set on the container: that is what the engine
          // places, and what carries the item's `aria-hidden`.
          interactive: ATTR_INTERACTIVE in (child.props as object),
        });
      }
    }
  };

  collect(children);

  return pieces;
}

/** A lone number stays a number, so `locale` and `decimals` can format it. */
function textValue(pieces: Piece[]): string | number | null {
  if (pieces.length === 0) return "";
  const only = pieces[0]!;
  if (pieces.length > 1 || only.kind !== "text" || only.format) return null;
  return only.value;
}

function plainText(pieces: Piece[]): string {
  return pieces
    .map((piece) => (piece.kind === "text" ? piece.value : ""))
    .join("");
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const TextMorph = ({
  children,
  cursorIndex,
  className,
  style,
  as = DEFAULT_AS,
  ...props
}: TextMorphProps) => {
  const { ref, update } = useTextMorph(props);
  const pieces = toPieces(children);
  const plain = textValue(pieces);

  const cursorRef = React.useRef(cursorIndex);
  cursorRef.current = cursorIndex;

  const { containerFor, portals } = useSlots(pieces, props.duration);

  const signature =
    plain === null
      ? pieces
          .map((piece) =>
            piece.kind === "text"
              ? `${formatKey(piece.format)}(${piece.value})`
              : piece.key,
          )
          .join(SEP)
      : String(plain);

  const piecesRef = React.useRef(pieces);
  piecesRef.current = pieces;

  // A container is a DOM node, and this renders on the server too — so the value
  // is built where it is used rather than in the body.
  React.useEffect(() => {
    const value: string | number | ContentPart[] =
      plain === null
        ? piecesRef.current.map((piece) =>
            piece.kind === "text"
              ? {
                  kind: "text" as const,
                  value: piece.value,
                  format: piece.format,
                }
              : elementPart(
                  piece.key,
                  containerFor(piece.key, piece.interactive),
                ),
          )
        : plain;

    update(value, cursorRef.current);
    // The value is rebuilt every render, so its signature is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, update]);

  const initialHTML = React.useRef({
    __html: escapeHTML(plainText(pieces)).replace(/\n/g, "<br>"),
  });

  const Component = as;

  // The portals sit beside the root, never inside it: the engine reparents what
  // it places, and React may not follow its own nodes across that move. Nothing
  // React renders is ever a child of the root — the initial markup is HTML.
  return (
    <>
      <Component
        ref={ref}
        className={className}
        style={style}
        dangerouslySetInnerHTML={initialHTML.current}
      />
      {portals}
    </>
  );
};

/**
 * A DOM container per element child, made outside React and never moved by it:
 * React renders into one, the engine places it. A child dropped from the value
 * is held for one morph, or it would blink out instead of animating away.
 */
function useSlots(pieces: Piece[], duration?: number) {
  const containers = React.useRef(new Map<string, HTMLSpanElement>());
  const previous = React.useRef(new Map<string, React.ReactNode>());
  const leaving = React.useRef(new Map<string, React.ReactNode>());
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);

  const current = new Map<string, React.ReactNode>();
  for (const piece of pieces) {
    if (piece.kind === "element") current.set(piece.key, piece.node);
  }

  for (const [key, node] of previous.current) {
    if (!current.has(key)) leaving.current.set(key, node);
  }
  for (const key of current.keys()) leaving.current.delete(key);
  previous.current = current;

  const held = Array.from(leaving.current.keys()).join(SEP);

  React.useEffect(() => {
    if (!held) return;
    const timer = window.setTimeout(() => {
      for (const key of held.split(SEP)) {
        leaving.current.delete(key);
        containers.current.delete(key);
      }
      rerender();
    }, duration ?? 400);
    return () => window.clearTimeout(timer);
  }, [held, duration]);

  const containerFor = (key: string, interactive = false) => {
    let node = containers.current.get(key);
    if (!node) {
      node = document.createElement("span");
      node.setAttribute(ATTR_KEY, key);
      containers.current.set(key, node);
    }
    node.toggleAttribute(ATTR_INTERACTIVE, interactive);
    return node;
  };

  const rendered: [string, React.ReactNode][] = [];
  for (const [key, node] of current) rendered.push([key, node]);
  for (const [key, node] of leaving.current) rendered.push([key, node]);

  return {
    containerFor,
    portals:
      typeof document === "undefined"
        ? null
        : rendered.map(([key, node]) =>
            createPortal(node, containerFor(key), key),
          ),
  };
}

export function useTextMorph(props: Omit<TextMorphOptions, "element">) {
  const ref = React.useRef<HTMLElement | null>(null);
  const controllerRef = React.useRef(new MorphController());

  const configKey = MorphController.serializeConfig(props);

  // Callbacks are kept out of the config key so changing one does not tear the morph
  // down, and read through a ref so they don't freeze on the state they saw at mount.
  const handlers = React.useRef(props);
  handlers.current = props;

  React.useEffect(() => {
    const controller = controllerRef.current;
    if (ref.current) {
      controller.attach(ref.current, {
        ...props,
        onAnimationStart: () => handlers.current.onAnimationStart?.(),
        onAnimationComplete: () => handlers.current.onAnimationComplete?.(),
      });
    }

    return () => {
      controller.destroy();
    };
    // Keyed on the serialized config; `props` identity would re-attach every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const update = React.useCallback(
    (value: string | number | ContentPart[], cursorIndex?: number) => {
      controllerRef.current.update(value, cursorIndex);
    },
    [],
  );

  return { ref, update };
}
