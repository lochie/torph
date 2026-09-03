import React from "react";
import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";

export function SandboxCard({
  speed,
  easing,
  align,
  debug,
}: {
  speed: Speed;
  easing: EasingKey;
  align: Align;
  debug: boolean;
}) {
  const [from, setFrom] = React.useState("hello world");
  const [to, setTo] = React.useState("world hello");
  const [current, setCurrent] = React.useState("hello world");

  const toggle = React.useCallback(() => {
    setCurrent((c) => (c === from ? to : from));
  }, [from, to]);

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Sandbox</h2>
        <div className={styles.tags}>
          <span className={styles.tag}>custom</span>
        </div>
      </header>

      <p className={styles.detailDescription}>
        Morph between any two values. Not part of the case corpus — nothing here
        is asserted.
      </p>

      <div className={styles.sandboxInputs}>
        <label className={styles.sandboxField}>
          <span className={styles.inspectorLabel}>from</span>
          <input
            className={styles.sandboxInput}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setCurrent(e.target.value);
            }}
          />
        </label>
        <label className={styles.sandboxField}>
          <span className={styles.inspectorLabel}>to</span>
          <input
            className={styles.sandboxInput}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <div
        className={styles.stage}
        style={{ textAlign: align }}
        // A pointer convenience, not a control — the "Morph" button is that.
        onClick={toggle}
      >
        <TextMorph
          duration={SPEEDS[speed]}
          ease={EASINGS[easing]}
          debug={debug}
        >
          {current}
        </TextMorph>
      </div>

      <div className={styles.stageBar}>
        <button type="button" className={styles.primaryBtn} onClick={toggle}>
          Morph
        </button>
      </div>
    </div>
  );
}
