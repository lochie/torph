import React from "react";
import type { TorphPlugin } from "torph";
import { TextMorph } from "torph/react";

import styles from "./styles.module.scss";

/** The same values twice, once as torph draws them and once through the plugin; a click swaps both. */
export const Compare = ({
  values,
  plugins,
  label,
  duration,
  mono,
  code,
}: {
  values: string[];
  plugins: readonly TorphPlugin[];
  label: string;
  duration?: number;
  /** Both rows in the monospace font. */
  mono?: boolean;
  /** Smaller monospace, for a few lines of code. */
  code?: boolean;
}) => {
  const morph = [
    styles.morph,
    (mono || code) && styles.mono,
    code && styles.code,
  ]
    .filter(Boolean)
    .join(" ");
  const [index, setIndex] = React.useState(0);
  const value = values[index]!;

  return (
    <button
      type="button"
      className={styles.compare}
      onClick={() => setIndex((i) => (i + 1) % values.length)}
    >
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
      <span className={styles.hint} aria-hidden>
        Click to swap
      </span>
    </button>
  );
};
