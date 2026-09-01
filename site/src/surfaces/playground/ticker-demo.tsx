import React from "react";
import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
import { SPEEDS, EASINGS, DECIMALS } from "./config";
import type { Speed, EasingKey, Align, Locale, DecimalsKey } from "./config";

const FORMATS = ["count", "currency", "percent", "compact"] as const;
type Format = (typeof FORMATS)[number];

function format(value: number, kind: Format, locale: string): string {
  switch (kind) {
    case "currency":
      return `$${value.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case "percent":
      return `${(value / 100).toFixed(1)}%`;
    case "compact":
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}K`
        : `${Math.round(value)}`;
    default:
      return Math.round(value).toLocaleString(locale);
  }
}

/** Module scope so the impurity stays out of the component body. */
function walkFrom(value: number): number {
  const next = value * (1 + (Math.random() - 0.48) * 0.15);
  return Math.max(1, Math.min(999999, next));
}

/**
 * Interval-driven updates, the one shape neither the case corpus nor the
 * sandbox produces: values landing on top of animations that have not finished.
 * Drop the interval below the duration and every morph interrupts a running
 * one, which is where cancelled-animation and stale-transform bugs surface.
 */
export function TickerDemo({
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
  const [value, setValue] = React.useState(1234.56);
  const [kind, setKind] = React.useState<Format>("currency");
  const [gap, setGap] = React.useState(700);
  const [running, setRunning] = React.useState(false);

  const walk = React.useCallback(() => setValue(walkFrom), []);

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(walk, gap);
    return () => window.clearInterval(id);
  }, [running, gap, walk]);

  // Eight updates at 60ms regardless of the interval — a burst lands inside any
  // duration the toolbar offers.
  const burst = React.useCallback(() => {
    for (let i = 0; i < 8; i++) window.setTimeout(walk, i * 60);
  }, [walk]);

  const duration = SPEEDS[speed];
  const interrupting = gap < duration;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Ticker</h2>
        <div className={styles.tags}>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.tag} ${kind === f ? styles.tagActive : ""}`}
              onClick={() => setKind(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <p className={styles.detailDescription}>
        A live value on a timer. Set the interval below the duration and each
        update interrupts the morph before it lands — the case corpus never does
        that, because every case waits for the previous step to finish.
      </p>

      <div
        className={styles.stage}
        style={{
          textAlign: align,
          fontVariantNumeric: tabular ? "tabular-nums" : "normal",
        }}
        role="presentation"
      >
        <TextMorph
          duration={duration}
          ease={EASINGS[easing]}
          locale={locale}
          decimals={DECIMALS[decimals]}
        >
          {format(value, kind, locale)}
        </TextMorph>
      </div>

      <div className={styles.stageBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? "Pause" : "Run"}
        </button>
        <button type="button" className={styles.btn} onClick={burst}>
          burst ×8
        </button>
        <button type="button" className={styles.btn} onClick={walk}>
          step
        </button>
        <label className={styles.range} title="Interval between updates">
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
          />
          <code>{gap}ms</code>
        </label>
        <span className={styles.spacer} />
        <span className={interrupting ? styles.fail : styles.pass}>
          {interrupting ? `interrupting ${duration}ms` : "settles"}
        </span>
      </div>
    </div>
  );
}
