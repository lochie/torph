import React from "react";
import { TextMorph } from "torph/react";
import { decimalSeparator } from "torph";
import styles from "./styles.module.scss";
import { SPEEDS, EASINGS, DECIMALS } from "./config";
import type { Speed, EasingKey, Align, Locale, DecimalsKey } from "./config";
import { AlignmentInspector } from "./alignment-inspector";

type Decomposed = {
  prefix: string;
  suffix: string;
  value: number;
  fractionDigits: number;
};

/**
 * Splits a typed value into its fixed affixes and the quantity between them, so
 * the stepper buttons can do arithmetic on "$1,234.50 /mo" without eating the
 * "$" or the "/mo".
 */
function decompose(value: string, decimalChar: string): Decomposed | null {
  const first = value.search(/\d/);
  if (first === -1) return null;

  let last = value.length - 1;
  while (last >= 0 && !/\d/.test(value[last]!)) last--;

  const body = value.slice(first, last + 1);
  const digits = [...body].filter((c) => /\d/.test(c) || c === decimalChar);
  const point = digits.indexOf(decimalChar);
  const parsed = Number(digits.join("").replace(decimalChar, "."));

  if (!Number.isFinite(parsed)) return null;

  return {
    prefix: value.slice(0, first),
    suffix: value.slice(last + 1),
    value: parsed,
    fractionDigits: point === -1 ? 0 : digits.length - point - 1,
  };
}

function recompose(
  parts: Decomposed,
  next: number,
  locale: string,
  fractionDigits: number,
): string {
  return (
    parts.prefix +
    next.toLocaleString(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }) +
    parts.suffix
  );
}

/** Module scope so the impurity stays out of the component body. */
function randomQuantity(): number {
  const magnitude = 10 ** Math.floor(Math.random() * 7);
  return Math.floor(Math.random() * magnitude);
}

const STEPS: [label: string, apply: (n: number) => number][] = [
  ["−1", (n) => n - 1],
  ["+1", (n) => n + 1],
  ["÷10", (n) => n / 10],
  ["×10", (n) => n * 10],
  ["±", (n) => -n],
];

export function NumberSandbox({
  speed,
  easing,
  align,
  locale,
  decimals,
  tabular,
}: {
  speed: Speed;
  easing: EasingKey;
  align: Align;
  locale: Locale;
  decimals: DecimalsKey;
  tabular: boolean;
}) {
  const [value, setValue] = React.useState("$1,234.50");
  const [previous, setPrevious] = React.useState("$1,234.50");
  const [cursor, setCursor] = React.useState<number | undefined>(undefined);
  const [useCursor, setUseCursor] = React.useState(true);

  const decimalChar = decimalSeparator(locale);
  const parts = decompose(value, decimalChar);

  const commit = (next: string, caret?: number) => {
    setPrevious(value);
    setValue(next);
    setCursor(caret);
  };

  // A stepper is a counter, not an edit — there is no caret behind it, so these
  // always go through place matching however the toggle is set.
  const step = (apply: (n: number) => number) => {
    if (!parts) return;
    const next = apply(parts.value);
    const fractionDigits = Number.isInteger(next) ? parts.fractionDigits : 2;
    commit(recompose(parts, next, locale, fractionDigits), undefined);
  };

  const randomise = () => {
    if (!parts) return;
    commit(
      recompose(parts, randomQuantity(), locale, parts.fractionDigits),
      undefined,
    );
  };

  const activeCursor = useCursor ? cursor : undefined;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Sandbox</h2>
        <div className={styles.tags}>
          <span className={styles.tag}>custom</span>
        </div>
      </header>

      <p className={styles.detailDescription}>
        Type in the field and the morph follows your caret — this is the shape a
        currency input takes in production. The steppers have no caret, so they
        fall back to place matching, the shape a counter takes. Nothing here is
        asserted.
      </p>

      <div className={styles.sandboxInputs}>
        <label className={styles.sandboxField}>
          <span className={styles.inspectorLabel}>value</span>
          <input
            className={styles.sandboxInput}
            value={value}
            onChange={(e) =>
              commit(e.target.value, e.target.selectionStart ?? undefined)
            }
          />
        </label>
      </div>

      <div
        className={styles.stage}
        style={{
          textAlign: align,
          fontVariantNumeric: tabular ? "tabular-nums" : "normal",
        }}
        role="presentation"
      >
        <TextMorph
          duration={SPEEDS[speed]}
          ease={EASINGS[easing]}
          locale={locale}
          decimals={DECIMALS[decimals]}
          cursorIndex={activeCursor}
        >
          {value}
        </TextMorph>
      </div>

      <div className={styles.stageBar}>
        {STEPS.map(([label, apply]) => (
          <button
            key={label}
            type="button"
            className={styles.btn}
            onClick={() => step(apply)}
            disabled={!parts}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={styles.btn}
          onClick={randomise}
          disabled={!parts}
        >
          random
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.btn} ${useCursor ? styles.btnActive : ""}`}
          onClick={() => setUseCursor((c) => !c)}
          title="Off, typed edits are matched by place value instead of by caret — the same keystroke reads as a change in magnitude"
        >
          cursor hint
        </button>
      </div>

      <AlignmentInspector
        from={previous}
        to={value}
        cursor={activeCursor}
        decimalChar={decimalChar}
      />
    </div>
  );
}
