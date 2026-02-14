"use client";

import React from "react";
import { TextMorph as Morph } from "../lib/text-morph";
import type { TextMorphOptions } from "../lib/text-morph/types";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: string; //React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof JSX.IntrinsicElements;
};

export const TextMorph = ({
  children,
  className,
  style,
  as = "div",
  ...props
}: TextMorphProps) => {
  const { ref, update } = useTextMorph(props);

  React.useEffect(() => {
    update(children);
  }, [children, update]);

  const Component = as as any;
  return <Component ref={ref} className={className} style={style} />;
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
