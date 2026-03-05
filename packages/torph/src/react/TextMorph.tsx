"use client";

import React from "react";
import { DEFAULT_AS, TextMorph as Morph } from "../lib/text-morph";
import type { TextMorphOptions } from "../lib/text-morph/types";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

function childrenToString(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(childrenToString).join("");
  if (React.isValidElement(node)) {
    throw new Error(
      "TextMorph only accepts text content. Found a React element — use strings, numbers, or expressions instead."
    );
  }
  throw new Error(
    `TextMorph received an unsupported child of type "${typeof node}".`
  );
}

export const TextMorph = ({
  children,
  className,
  style,
  as = DEFAULT_AS,
  ...props
}: TextMorphProps) => {
  const { ref, update } = useTextMorph(props);
  const text = childrenToString(children);
  const initialHTML = React.useRef({ __html: text });

  React.useEffect(() => {
    update(text);
  }, [text, update]);

  const Component = as;

  return (
    <Component
      ref={ref}
      className={className}
      style={style}
      dangerouslySetInnerHTML={initialHTML.current}
    />
  );
};

export function useTextMorph(props: Omit<TextMorphOptions, "element">) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const morphRef = React.useRef<Morph | null>(null);

  React.useEffect(() => {
    if (ref.current) {
      morphRef.current = new Morph({ element: ref.current, ...props });
    }

    return () => {
      morphRef.current?.destroy();
    };
  }, []);

  const update = React.useCallback((text: string) => {
    morphRef.current?.update(text);
  }, []);

  return { ref, update };
}
