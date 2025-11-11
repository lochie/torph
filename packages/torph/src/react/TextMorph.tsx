"use client";

import React from "react";
import { TextMorph as Morph } from "../lib/text-morph";
import type { TextMorphOptions } from "../lib/text-morph/types";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: string; //React.ReactNode;
};

export const TextMorph = ({ children, ...props }: TextMorphProps) => {
  const { ref, update } = useTextMorph(props);

  React.useEffect(() => {
    update(children);
  }, [children, update]);

  return <div ref={ref} />;
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
