import React from "react";
import styles from "./styles.module.scss";
import { numberTorph } from "./number-tests";
import { alignment } from "@torph/test-cases";

/**
 * Where every character of the new value came from. Unlike the text inspector
 * this reports an origin *index* rather than a bare persisted/entered flag —
 * for a number, which character it came from is the whole question.
 */
export function AlignmentInspector({
  from,
  to,
  cursor,
  decimalChar,
}: {
  from: string;
  to: string;
  cursor?: number;
  decimalChar: string;
}) {
  const places = alignment(numberTorph, from, to, { cursor, decimalChar });
  const held = new Set(places.filter((p): p is number => p !== null));
  const show = (v: string) => (v === " " ? "·" : v);

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorRow}>
        <span className={styles.inspectorLabel}>before</span>
        <div className={styles.chips}>
          {from.split("").map((char, i) => (
            <span
              key={i}
              className={`${styles.chip} ${held.has(i) ? styles.chipPersisted : ""}`}
              title={held.has(i) ? `index ${i} — persists` : `index ${i} — exits`}
            >
              {show(char)}
              <em>{i}</em>
            </span>
          ))}
        </div>
      </div>
      <div className={styles.inspectorRow}>
        <span className={styles.inspectorLabel}>after</span>
        <div className={styles.chips}>
          {to.split("").map((char, i) => {
            const origin = places[i];
            return (
              <span
                key={i}
                className={`${styles.chip} ${
                  origin === null ? styles.chipNew : styles.chipPersisted
                }`}
                title={
                  origin === null
                    ? `index ${i} — enters`
                    : `index ${i} — from index ${origin}`
                }
              >
                {show(char)}
                <em>{origin === null ? "new" : `←${origin}`}</em>
              </span>
            );
          })}
        </div>
      </div>
      <div className={styles.inspectorRow}>
        <span className={styles.inspectorLabel}>pivot</span>
        <div className={styles.chips}>
          <span className={styles.chip}>
            {decimalChar}
            <em>decimal separator</em>
          </span>
          <span className={styles.chip}>
            {cursor == null ? "place" : `cursor ${cursor}`}
            <em>matching</em>
          </span>
        </div>
      </div>
    </div>
  );
}
