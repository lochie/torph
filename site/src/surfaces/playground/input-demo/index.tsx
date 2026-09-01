"use client";

import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";

import React from "react";
import { InputNumber } from "./input";

export const InputPlayground = () => {
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState<number | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={styles.container}>
      <InputNumber value={query} onValueChange={setQuery} />
      <div className={styles.input}>
        <input
          ref={inputRef}
          placeholder="Type something..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(inputRef.current?.selectionStart ?? undefined);
          }}
        />
        <div className={styles.output}>
          <TextMorph cursorIndex={cursor}>{query}</TextMorph>
        </div>
      </div>
    </div>
  );
};
