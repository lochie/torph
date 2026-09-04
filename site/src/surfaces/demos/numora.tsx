import styles from "./inline.module.scss";

import React from "react";
import { FormatOn, NumoraInput, ThousandStyle } from "numora";
import { TextMorph } from "torph/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export const SCRIPT = "1234567.89";

const TYPE_MS = 220;
const HOLD = 1800; // Beat on the formatted total before it clears and starts over

export const NumoraField = () => {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const numoraRef = React.useRef<NumoraInput>(null);
  const [value, setValue] = React.useState("");
  const [caret, setCaret] = React.useState<number>();
  const [typed, setTyped] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const sync = React.useCallback((input: HTMLInputElement) => {
    setValue(input.value);
    setCaret(input.selectionStart ?? undefined);
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const numora = new NumoraInput(host, {
      formatOn: FormatOn.Change,
      decimalMaxLength: 2,
      thousandStyle: ThousandStyle.Thousand,
      rawValueMode: true,
      onChange: () => sync(numora.getElement()),
    });

    const input = numora.getElement();
    input.setAttribute("aria-label", "Amount");
    input.setAttribute("inputmode", "decimal");
    numoraRef.current = numora;

    return () => input.remove();
  }, [sync]);

  const shown = reducedMotion ? SCRIPT : SCRIPT.slice(0, typed);

  React.useEffect(() => {
    const numora = numoraRef.current;
    if (!numora || taken) return;
    numora.setValue(shown);
    sync(numora.getElement());
  }, [shown, taken, sync]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const done = typed >= SCRIPT.length;
    const timer = window.setTimeout(
      () => setTyped(done ? 0 : typed + 1),
      done ? HOLD : TYPE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [typed, taken, reducedMotion]);

  return (
    <>
      <label className={styles.numora} onPointerDown={() => setTaken(true)}>
        {/* A rendering of the field's own value; reading it back doubles it. */}
        <TextMorph
          className={styles.numoraDisplay}
          cursorIndex={caret}
          aria-hidden
          style={{
            opacity: value ? 1 : 0.5,
          }}
        >
          {value || "0"}
        </TextMorph>

        <div
          className={styles.numoraHost}
          ref={hostRef}
          onFocus={() => setTaken(true)}
          onKeyDown={() => setTaken(true)}
        />
      </label>
    </>
  );
};
