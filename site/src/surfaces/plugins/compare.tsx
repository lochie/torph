import React from "react";
import type { TorphPlugin } from "torph";
import { TextMorph } from "torph/react";

import styles from "./styles.module.scss";

type Look = {
  plugins: readonly TorphPlugin[];
  label: string;
  duration?: number;
  /** Both rows in the monospace font. */
  mono?: boolean;
  /** Smaller monospace, for a few lines of code. */
  code?: boolean;
};

/** One value twice: as torph draws it, and through the plugins. */
const Pair = ({
  value,
  plugins,
  label,
  duration,
  mono,
  code,
}: Look & { value: string }) => {
  const morph = [
    styles.morph,
    (mono || code) && styles.mono,
    code && styles.code,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <span className={styles.row}>
        <span className={styles.tag}>default</span>
        <TextMorph className={morph} duration={duration}>
          {value}
        </TextMorph>
      </span>
      <span className={styles.row}>
        <span className={styles.tag}>{label}</span>
        <TextMorph className={morph} duration={duration} plugins={plugins}>
          {value}
        </TextMorph>
      </span>
    </>
  );
};

/** The same values twice, once as torph draws them and once through the plugin; a click swaps both. */
export const Compare = ({ values, ...look }: Look & { values: string[] }) => {
  const [index, setIndex] = React.useState(0);

  return (
    <button
      type="button"
      className={styles.compare}
      onClick={() => setIndex((i) => (i + 1) % values.length)}
    >
      <Pair value={values[index]!} {...look} />
      <span className={styles.hint} aria-hidden>
        Click to swap
      </span>
    </button>
  );
};

/** As `Compare`, for a value that changes by itself. */
export const Live = ({ value, ...look }: Look & { value: string }) => (
  <div className={styles.compare} data-live="">
    <Pair value={value} {...look} />
  </div>
);
