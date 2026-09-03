"use client";

import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";

import React from "react";

export const InputPlayground = () => {
  const [query, setQuery] = React.useState<number | undefined>(undefined);
  const [cursor, setCursor] = React.useState<number | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={styles.container}>
      <div
        className={styles.output}
        // A rendering of the field's own value; reading it back doubles it.
        aria-hidden="true"
        style={{
          opacity: query === undefined ? 0.5 : 1,
        }}
      >
        <TextMorph cursorIndex={cursor}>{query || 0}</TextMorph>
      </div>
      <div className={styles.input}>
        <input
          ref={inputRef}
          aria-label="Number to morph"
          placeholder="Type something..."
          value={query}
          type="number"
          onChange={(e) => {
            setCursor(inputRef.current?.selectionStart ?? undefined);

            setQuery(e.target.valueAsNumber || undefined);
          }}
        />
      </div>
    </div>
  );
};
