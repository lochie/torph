"use client";

import React from "react";
import { DEFAULT_AS } from "../lib/text-morph";
import { MorphController } from "../lib/text-morph/controller";
import type { TextMorphOptions } from "../lib/text-morph/types";

export type TextMorphProps = Omit<TextMorphOptions, "element"> & {
  children: React.ReactNode;
  /**
   * Caret position, for a value that is a single number. Switches that step
   * from place matching to caret matching — what an editable field wants.
   */
  cursorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

/**
 * A lone number is handed over as a number so `locale` and `decimals` can
 * format it. Anything else is already text by the time it gets here.
 */
function childrenToValue(node: React.ReactNode): string | number {
  if (typeof node === "number") return node;
  return childrenToString(node);
}

function childrenToString(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(childrenToString).join("");
  if (React.isValidElement(node)) {
    throw new Error(
      "TextMorph only accepts text content. Found a React element — use strings, numbers, or expressions instead.",
    );
  }
  throw new Error(
    `TextMorph received an unsupported child of type "${typeof node}".`,
  );
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
  const value = childrenToValue(children);
  const cursorRef = React.useRef(cursorIndex);
  cursorRef.current = cursorIndex;
  const initialHTML = React.useRef({
    __html: escapeHTML(String(value)).replace(/\n/g, "<br>"),
  });

  React.useEffect(() => {
    update(value, cursorRef.current);
  }, [value, update]);

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
  const ref = React.useRef<HTMLElement | null>(null);
  const controllerRef = React.useRef(new MorphController());

  const configKey = MorphController.serializeConfig(props);

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
    (value: string | number, cursorIndex?: number) => {
      controllerRef.current.update(value, cursorIndex);
    },
    [],
  );

  return { ref, update };
}
