"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";

import styles from "./styles.module.scss";
import { stringToLocaleString } from "./utils";
import { useMouse } from "./useMouse";
import { TextMorph } from "torph/react";

const MAX_FONT_SIZE = 80;
const MIN_FONT_SIZE = 16;

const validateInput = (value: string, decimals: number) => {
  if (value === ".") throw new Error("Cannot start with a dot");
  if (value.includes("..")) throw new Error("Cannot include multiple dots");
  if (value.match(/\d+\.\d+\./))
    throw new Error("Cannot include multiple dots");
  if (value.match(/\./g) && value.split(".")[1].length > decimals)
    throw new Error(`Cannot include more than ${decimals} decimal places`);
  if (value.match(/^0\d/)) throw new Error("Cannot include leading zeros");
  if (value.match(/^\./)) throw new Error("Cannot include leading dots");
  if (!value.match(/^\d*\.?\d*$/))
    throw new Error("Cannot include invalid characters");

  if (parseFloat(value) > Number.MAX_SAFE_INTEGER)
    throw new Error("Cannot exceed maximum safe integer");
  return true;
};

export type InputProps = {
  max?: number;
  decimals?: number;
  prefix?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export const InputNumber = ({
  max = 1000000000000,
  decimals = 2,
  prefix = "",
  value: initialValue,
  onValueChange,
  disabled,
  autoFocus,
}: InputProps) => {
  const id = useId();
  const [value, setValue] = useState<string>(initialValue ?? "");

  useEffect(() => {
    const raw = initialValue ?? "";
    setValue(raw);
    if (inputRef.current) {
      inputRef.current.value = stringToLocaleString(raw);
    }
    updateCaret();
  }, [initialValue]);

  const { mouse } = useMouse();

  const formattedValue = stringToLocaleString(value);

  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLSpanElement>(null);

  const updateContainerSize = () => {
    if (inputContainerRef.current && inputRef.current) {
      const container = inputContainerRef.current;
      const input = inputRef.current;
      const displayLength = input.value.length || 1;

      const fontSize = Math.min(
        MAX_FONT_SIZE,
        Math.max(MIN_FONT_SIZE, container.offsetWidth / displayLength),
      );

      container.style.fontSize = `${fontSize}px`;
    }
  };

  useEffect(() => {
    updateContainerSize();
  }, [value]);

  const updateValidValue = (v: string, target: HTMLInputElement) => {
    const oldFormatted = stringToLocaleString(value);
    const newFormatted = stringToLocaleString(v);
    const cursorPos = target.selectionStart ?? newFormatted.length;
    const cursorOffset = newFormatted.length - oldFormatted.length;

    setValue(v);
    onValueChange?.(v);
    target.value = newFormatted;

    const newCursor = Math.max(0, cursorPos + cursorOffset);
    target.setSelectionRange(newCursor, newCursor);

    updateContainerSize();
    updateCaret({ value: newFormatted });
  };

  const getCaretPosition = (v: string, start: number, end: number) => {
    if (!(inputRef.current && hiddenRef.current && caretRef.current)) {
      return {
        width: 0,
        x: 0,
      };
    }
    //document.body.appendChild(hiddenRef.current); // show element
    const hidden = hiddenRef.current;
    hidden.innerHTML = v.substring(start, end);
    //hidden.remove(); // hide element
    return {
      width: 1,
      x: hidden.offsetWidth,
    };
  };

  const selectAll = () => {
    const input = inputRef.current;
    const caret = caretRef.current;
    if (input && caret) {
      input.setSelectionRange(0, input.value.length, "forward");
      requestAnimationFrame(() => {
        updateCaret();
        caret.style.left = "0px";
        caret.style.transform = `translateX(0px)`;
      });
    }
  };

  const updateCaret = ({
    isMouse,
    value: overrideValue,
  }: {
    isMouse?: boolean;
    value?: string;
  } = {}) => {
    if (isMouse && !mouse.isDown) return;
    const v = overrideValue ?? formattedValue;
    if (inputRef.current && hiddenRef.current && caretRef.current) {
      const caret = caretRef.current;
      const input = inputRef.current;
      const hidden = hiddenRef.current;

      const caretX =
        caret.getBoundingClientRect().left + caret.offsetWidth * 0.5;
      const selectionDirectionForwards = isMouse
        ? mouse.horizontal === "right"
          ? mouse.x > caretX
          : mouse.x > caretX
        : input.selectionDirection === "forward";

      caret.setAttribute("data-blink", "false");
      requestAnimationFrame(() => {
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? v.toString().length;
        const length = end - start;

        hidden.style.maxWidth = `${input.offsetWidth}px`;
        if (input.value.length > 0 && length === input.value.length) {
          const c = getCaretPosition(v, start, end);
          caret.style.width = `${c.x}px`;
          caret.style.left = `0px`;
          caret.style.transform = `translateX(0px)`;
        } else if (length > 0) {
          const c = getCaretPosition(v, start, end);
          caret.style.width = `${c.x}px`;
          caret.style.left = selectionDirectionForwards ? `0px` : `-${c.x}px`;
        } else {
          // caret position
          const c = getCaretPosition(
            v,
            0,
            !selectionDirectionForwards ? start : end,
          );
          caret.style.transform = `translateX(${c.x}px)`;

          caret.style.width = `${c.width}px`;
          caret.style.left = "0px";
          caret.setAttribute("data-blink", "true");
        }
      });
    }
  };

  return (
    <div className={styles.container}>
      <div ref={inputContainerRef} className={styles.inputContainer}>
        <div className={styles.valueContainer}>
          <div className={styles.valueContainerInner}>
            <AnimatePresence initial={false} mode="popLayout">
              {prefix && (
                <motion.sup
                  layout="position"
                  layoutId="prefix-character"
                  initial={{ scale: 0.8, opacity: 1 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                  }}
                >
                  {prefix}
                </motion.sup>
              )}
            </AnimatePresence>
            <div className={styles.value}>
              <div className={styles.caret} ref={caretRef} />
              <TextMorph
                cursorIndex={inputRef.current?.selectionStart ?? undefined}
              >
                {formattedValue || "0"}
              </TextMorph>
            </div>
          </div>
        </div>
        <input
          id={id}
          ref={inputRef}
          className={styles.input}
          disabled={disabled}
          autoComplete="off"
          type="text" // using text to allow for caret positioning
          inputMode="decimal"
          value={formattedValue}
          autoFocus={autoFocus}
          readOnly={!onValueChange}
          onFocus={() => updateCaret({ isMouse: true })}
          onMouseMove={() => updateCaret({ isMouse: true })}
          onTouchMove={() => updateCaret({ isMouse: true })}
          onClick={() => updateCaret({ isMouse: true })}
          onKeyDown={() => updateCaret()}
          onDoubleClick={() => selectAll()}
          onChange={(e) => {
            if (disabled) return;
            e.preventDefault();
            let v = e.target.value.replace(/,/g, "");
            if (v[0] === ".") v = "0" + v;
            if (v === "00") {
              e.target.value = formattedValue;
              if (e.target.getAttribute("data-pop")) return;
              e.target.setAttribute("data-pop", "true");
              setTimeout(() => {
                e.target.removeAttribute("data-pop");
              }, 200);
              return;
            }
            try {
              if (max !== undefined && parseFloat(v) > max)
                throw new Error("Cannot exceed maximum value");
              validateInput(v, decimals);
              updateValidValue(v, e.target);
            } catch {
              e.target.value = formattedValue;
              if (e.target.getAttribute("data-invalid")) return;
              e.target.setAttribute("data-invalid", "true");
              setTimeout(() => {
                e.target.removeAttribute("data-invalid");
              }, 200);
            }
          }}
        />
        <span
          ref={hiddenRef}
          className={styles.input}
          style={{
            position: "absolute",
            display: "inline-block",
            width: "auto",
            overflow: "hidden",
            height: 0,
            transition: "none",
          }}
        />
      </div>
    </div>
  );
};
