"use client";

import React from "react";
import { DEFAULT_AS, TextMorph as Morph } from "../lib/text-morph";
import type { TextMorphOptions } from "../lib/text-morph/types";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: string; //React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

export const TextMorph = ({
  children,
  className,
  style,
  as = DEFAULT_AS,
  ...props
}: TextMorphProps) => {
  const { ref, update } = useTextMorph(props);
  const initialHTML = React.useRef({ __html: children });

  React.useEffect(() => {
    update(children);
  }, [children, update]);

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

  const update = (text: string) => {
    morphRef.current?.update(text);
  };

  return { ref, update };
}
