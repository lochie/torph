import React from "react";
import { classic, type TorphPlugin } from "torph";
import { TextMorph } from "torph/react";

import styles from "./styles.module.scss";

/** Set by the card's "vs default" toggle: every stage in it adds a row as torph draws it. */
export const ShowDefault = React.createContext(false);

type Look = {
  plugins: readonly TorphPlugin[];
  duration?: number;
  /** In the monospace font. */
  mono?: boolean;
  /** Smaller monospace, for a few lines of code. */
  code?: boolean;
};

const Rows = ({
  value,
  plugins,
  duration,
  mono,
  code,
}: Look & { value: string }) => {
  const showDefault = React.useContext(ShowDefault);
  const morph = [
    styles.morph,
    (mono || code) && styles.mono,
    code && styles.code,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <TextMorph
        className={morph}
        duration={duration}
        plugins={[...plugins, ...classic()]}
      >
        {value}
      </TextMorph>
      {showDefault && (
        <span className={styles.default}>
          <span className={styles.defaultTag}>default</span>
          <TextMorph className={morph} duration={duration}>
            {value}
          </TextMorph>
        </span>
      )}
    </>
  );
};

/** Values that a click steps through. */
export const Compare = ({ values, ...look }: Look & { values: string[] }) => {
  const [index, setIndex] = React.useState(0);
  return (
    <button
      type="button"
      className={styles.stage}
      onClick={() => setIndex((i) => (i + 1) % values.length)}
      aria-label="Next value"
    >
      <Rows value={values[index]!} {...look} />
    </button>
  );
};

/** As `Compare`, for a value that changes by itself. */
export const Live = ({ value, ...look }: Look & { value: string }) => (
  <div className={styles.stage} data-live="">
    <Rows value={value} {...look} />
  </div>
);
