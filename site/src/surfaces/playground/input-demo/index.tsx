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
      <div className={styles.output}>
        <TextMorph cursorIndex={cursor}>{query}</TextMorph>
      </div>
      <div className={styles.input}>
        <input
          ref={inputRef}
          placeholder="Type something..."
          value={query}
          type="number"
          onChange={(e) => {
            setCursor(inputRef.current?.selectionStart ?? undefined);
            setQuery(e.target.valueAsNumber);
          }}
        />
      </div>
    </div>
  );
};
