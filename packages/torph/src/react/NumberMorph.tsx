"use client";

import React from "react";
import { NumberMorphController } from "../lib/number-morph/controller";
import type { NumberMorphOptions } from "../lib/number-morph/types";

export type NumberMorphProps = Omit<NumberMorphOptions, "element"> & {
  children: number | string;
  cursorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

function childrenToValue(node: React.ReactNode): number | string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(childrenToValue).join("");
  return "";
}

export const NumberMorph = ({
  children,
  cursorIndex,
  className,
  style,
  as: Component = "span",
  ...props
}: NumberMorphProps) => {
  const { ref, update } = useNumberMorph(props);
  const value = childrenToValue(children);
  const cursorRef = React.useRef(cursorIndex);
  cursorRef.current = cursorIndex;
  const initialHTML = React.useRef({
    __html: typeof value === "number" ? String(value) : value,
  });

  React.useEffect(() => {
    update(value, cursorRef.current);
  }, [value, update]);

  return (
    <Component
      ref={ref}
      className={className}
      style={style}
      dangerouslySetInnerHTML={initialHTML.current}
    />
  );
};

export function useNumberMorph(props: Omit<NumberMorphOptions, "element">) {
  const ref = React.useRef<HTMLElement | null>(null);
  const controllerRef = React.useRef(new NumberMorphController());

  const configKey = NumberMorphController.serializeConfig(props);

  // Callbacks are deliberately absent from the config key — changing one should
  // not tear the morph down. That leaves them captured at attach time, so they
  // are called through a ref instead: a handler closing over component state is
  // the normal case, and a frozen one would silently keep reading the state it
  // saw on mount.
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
    // Keyed on the serialized config: re-attaching on every `props` identity
    // would tear the controller down on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const update = React.useCallback(
    (value: number | string, cursorIndex?: number) => {
      controllerRef.current.update(value, cursorIndex);
    },
    [],
  );

  return { ref, update };
}
