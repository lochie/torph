import React from "react";
import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
import { SPEEDS, EASINGS, DECIMALS } from "./config";
import type { Speed, EasingKey, Locale, DecimalsKey } from "./config";

function nextValue(value: number): number {
  const next = value * (1 + (Math.random() - 0.5) * 0.4);
  return Math.max(1, Math.min(99999, next));
}

/**
 * A digit slides inside its own clipped box, and that box is one line tall. Below
 * a line-height of about 1 the glyph is taller than its box, so the clip and fade
 * must come off once the slide lands — the plain copy beside it is the reference.
 */
export function LineHeightDemo({
  speed,
  easing,
  locale,
  decimals,
  tabular,
}: {
  speed: Speed;
  easing: EasingKey;
  locale: Locale;
  decimals: DecimalsKey;
  tabular: boolean;
}) {
  const [value, setValue] = React.useState(1234.56);
  const [lineHeight, setLineHeight] = React.useState(0.8);
  const [showBox, setShowBox] = React.useState(true);

  const text = `$${value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const specimen = {
    lineHeight,
    fontVariantNumeric: tabular ? "tabular-nums" : "normal",
  };
  const box = showBox ? styles.lineBox : undefined;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Line height</h2>
      </header>

      <p className={styles.detailDescription}>
        A tight line-height makes each digit taller than its line box. While a
        digit slides it is clipped to that box; once it lands it should match
        the plain copy exactly, with no shaved or faded edges.
      </p>

      <div
        className={styles.stage}
        role="presentation"
        onClick={() => setValue(nextValue)}
      >
        <div className={styles.comparison}>
          <div className={styles.specimen}>
            <span className={styles.specimenLabel}>torph</span>
            <span className={box} style={specimen}>
              <TextMorph
                duration={SPEEDS[speed]}
                ease={EASINGS[easing]}
                locale={locale}
                decimals={DECIMALS[decimals]}
              >
                {text}
              </TextMorph>
            </span>
          </div>
          <div className={styles.specimen}>
            <span className={styles.specimenLabel}>plain</span>
            <span className={box} style={specimen}>
              {text}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.stageBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => setValue(nextValue)}
        >
          step
        </button>
        <label className={styles.range} title="line-height">
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
          />
          <code>{lineHeight.toFixed(2)}</code>
        </label>
        <button
          type="button"
          className={`${styles.btn} ${showBox ? styles.tagActive : ""}`}
          onClick={() => setShowBox((s) => !s)}
        >
          line box
        </button>
      </div>
    </div>
  );
}
