import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

import { useCycle } from "./use-cycle";

export const INSTALL = [
  "npm i torph",
  "pnpm add torph",
  "yarn add torph",
  "bun add torph",
];

export const Install = () => {
  const index = useCycle(INSTALL.length, 1600);

  return (
    <div className={`${styles.stage} ${styles.stageSmall} ${styles.mono}`}>
      <span className={styles.prompt}>$ </span>
      <TextMorph>{INSTALL[index]!}</TextMorph>
    </div>
  );
};

export const VERSIONS = ["v1.2.3", "v1.3.0", "v2.0.0", "v2.0.1"];

export const Versions = () => {
  const index = useCycle(VERSIONS.length, 1400);

  return (
    <TextMorph className={`${styles.stage} ${styles.mono}`}>
      {VERSIONS[index]!}
    </TextMorph>
  );
};

export const DATES = ["2024-01-01", "2024-02-01", "2024-02-14", "2025-02-14"];

export const Dates = () => {
  const index = useCycle(DATES.length, 1400);

  return (
    <TextMorph className={`${styles.stage} ${styles.mono}`}>
      {DATES[index]!}
    </TextMorph>
  );
};

export const TOTALS = ["1,204", "1,318", "9,847", "986"];

export const NumbersOff = () => {
  const index = useCycle(TOTALS.length, 1800);

  return (
    <div className={styles.split}>
      <div className={styles.splitItem}>
        <TextMorph className={styles.stage}>{TOTALS[index]!}</TextMorph>
        <span className={styles.caption}>default</span>
      </div>

      <div className={styles.splitItem}>
        <TextMorph className={styles.stage} numbers={false}>
          {TOTALS[index]!}
        </TextMorph>
        <span className={styles.caption}>numbers={"{false}"}</span>
      </div>
    </div>
  );
};

export const EMOJI = ["Hello 👋", "Goodbye 👋", "Goodbye 👨‍👩‍👧‍👦", "Hello 👨‍👩‍👧‍👦"];

export const Emoji = () => {
  const index = useCycle(EMOJI.length, 1600);

  return <TextMorph className={styles.stage}>{EMOJI[index]!}</TextMorph>;
};

export const ARABIC = ["مرحبا بالعالم", "مرحبا يا صديقي"];
export const HEBREW = ["שלום עולם", "שלום חברים"];

export const Scripts = () => {
  const index = useCycle(2, 2000);

  return (
    <div className={styles.split}>
      <div className={styles.splitItem} dir="rtl">
        <TextMorph className={`${styles.stage} ${styles.stageSmall}`}>
          {ARABIC[index]!}
        </TextMorph>
        <span className={styles.caption} dir="ltr">
          ar
        </span>
      </div>

      <div className={styles.splitItem} dir="rtl">
        <TextMorph className={`${styles.stage} ${styles.stageSmall}`}>
          {HEBREW[index]!}
        </TextMorph>
        <span className={styles.caption} dir="ltr">
          he
        </span>
      </div>
    </div>
  );
};

export const QUANTITIES = ["$1,204.50", "$1,318.20", "$986.00"];
export const NOT_QUANTITIES = ["16px", "24px", "32px"];

export const NumericGate = () => {
  const index = useCycle(3, 1700);

  return (
    <div className={styles.split}>
      <div className={styles.splitItem}>
        <TextMorph className={styles.stage}>{QUANTITIES[index]!}</TextMorph>
        <span className={styles.caption}>a quantity — place value</span>
      </div>

      <div className={styles.splitItem}>
        <TextMorph className={styles.stage}>{NOT_QUANTITIES[index]!}</TextMorph>
        <span className={styles.caption}>contains digits — text</span>
      </div>
    </div>
  );
};

export const CLOCK = ["09:58", "09:59", "10:00", "10:01"];

export const ClockFace = () => {
  const index = useCycle(CLOCK.length, 1200);

  return (
    <TextMorph
      className={`${styles.stage} ${styles.stageLarge} ${styles.tabular}`}
    >
      {CLOCK[index]!}
    </TextMorph>
  );
};

// Fixed saturation and lightness, so the slider moves hue alone.
const hex = (hue: number) => {
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = 0.5 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0");
  };

  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

export const HexColour = () => {
  const [hue, setHue] = React.useState(0);
  const value = hex(hue);

  return (
    <div className={styles.driven}>
      <div
        className={styles.swatchRow}
        style={{
          color: value,
        }}
      >
        <TextMorph>{value}</TextMorph>
      </div>
      <div className={styles.swatches}>
        {Array.from({ length: 12 }, (_, i) => {
          const h = i * 30;
          return (
            <button
              key={h}
              className={styles.swatch}
              style={{ background: hex(h) }}
              data-active={hue === h}
              onClick={() => setHue(h)}
            />
          );
        })}
      </div>
    </div>
  );
};

export const GLUED = ["819K", "990K", "9.9M", "19.4M"];
export const SPACED = ["910 KB", "1.2 MB", "12 MB", "1.25 GB"];

export const Units = () => {
  const index = useCycle(4, 1600);

  return (
    <div className={styles.split}>
      <div className={styles.splitItem}>
        <TextMorph className={styles.stage}>{GLUED[index]!}</TextMorph>
      </div>
      –
      <div className={styles.splitItem}>
        <TextMorph className={styles.stage}>{SPACED[index]!}</TextMorph>
      </div>
    </div>
  );
};
