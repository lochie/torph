import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useCycle } from "./use-cycle";

export const ROWS = [
  { label: "Impressions", values: ["48,210", "51,884", "47,905"] },
  { label: "Clicks", values: ["3,417", "3,902", "3,118"] },
  { label: "Spend", values: ["$1,204.50", "$1,388.20", "$1,097.75"] },
];

export const TabularTable = () => {
  const index = useCycle(3, 1800);

  return (
    <div className={styles.table}>
      {ROWS.map((row) => (
        <div key={row.label} className={styles.tableRow}>
          <span className={styles.tableLabel}>{row.label}</span>
          <TextMorph className={styles.tableValue}>
            {row.values[index]!}
          </TextMorph>
        </div>
      ))}
    </div>
  );
};

// Back down as well as up: the comma has to be the same comma both ways.
export const MAGNITUDE = [
  "9,998",
  "9,999",
  "10,000",
  "10,001",
  "10,000",
  "9,999",
];

export const Magnitude = () => {
  const index = useCycle(MAGNITUDE.length, 1000);

  return (
    <TextMorph className={`${styles.stage} ${styles.tabular}`}>
      {MAGNITUDE[index]!}
    </TextMorph>
  );
};

// U+2212, not a hyphen — it is the width of the plus it replaces.
export const DELTAS = ["+2.4%", "−0.8%", "+11.2%", "0.0%", "−13.6%"];

export const Delta = () => {
  const index = useCycle(DELTAS.length, 1600);
  const value = DELTAS[index]!;
  const color = value.startsWith("−")
    ? "#ff6b6b"
    : value.startsWith("+")
      ? "#4ade80"
      : "#ffffff";

  return (
    <div className={styles.badge}>
      <TextMorph
        style={{ color }}
        ease={{
          stiffness: 150,
          damping: 19,
          mass: 1.2,
        }}
      >
        {value}
      </TextMorph>
    </div>
  );
};

export const CURRENCIES = ["$99.00", "€99.00", "£99.00", "¥99.00"];

export const CurrencySwap = () => {
  const index = useCycle(CURRENCIES.length, 1400);

  return (
    <TextMorph className={`${styles.stage} ${styles.stageLarge}`}>
      {CURRENCIES[index]!}
    </TextMorph>
  );
};

export const LOCALES = ["en-US", "de-DE", "fr-FR"];
export const AMOUNTS = [1234567.891, 9876543.21, 1234.5, 987654.3];

// Three elements, because `locale` is instance configuration, not a live prop.
export const Locales = () => {
  const index = useCycle(AMOUNTS.length, 2000);

  return (
    <div className={styles.split}>
      {LOCALES.map((locale) => (
        <div key={locale} className={styles.splitItem}>
          <TextMorph
            className={`${styles.stage} ${styles.stageSmall}`}
            locale={locale}
            decimals={2}
          >
            {AMOUNTS[index]!}
          </TextMorph>
          <span className={styles.caption}>{locale}</span>
        </div>
      ))}
    </div>
  );
};

export const LEDGER = [
  "12,480",
  "Revenue\n12,480",
  "Revenue\n13,905",
  "Revenue\n13,905\nLast month 12,480",
];

export const Ledger = () => {
  const index = useCycle(LEDGER.length, 2000);

  return (
    <TextMorph
      className={`${styles.stage} ${styles.stageSmall}`}
      style={{ textAlign: "left" }}
    >
      {LEDGER[index]!}
    </TextMorph>
  );
};

export const RANKS = ["#6", "#5", "#4", "#3", "#2", "#1"];
export const WRITTEN = ["6th", "5th", "4th", "3rd", "2nd", "1st"];

// The number matcher accepts "#", so "#4" is a quantity and "4th" is not.
export const Ordinals = () => {
  const index = useCycle(RANKS.length, 1500);

  return (
    <div className={styles.split}>
      <div className={styles.splitItem}>
        <TextMorph className={`${styles.stage} ${styles.stageLarge}`}>
          {RANKS[index]!}
        </TextMorph>
        <span className={styles.caption}>place value</span>
      </div>

      <div className={styles.splitItem}>
        <TextMorph className={`${styles.stage} ${styles.stageLarge}`}>
          {WRITTEN[index]!}
        </TextMorph>
        <span className={styles.caption}>text</span>
      </div>
    </div>
  );
};

export const DIMENSIONS = [
  "320 \u00D7 240",
  "640 \u00D7 480",
  "1280 \u00D7 720",
  "1920 \u00D7 1080",
];

export const Dimensions = () => {
  const index = useCycle(DIMENSIONS.length, 1600);

  return (
    <div className={`${styles.stage} ${styles.tabular}`}>
      <TextMorph
        ease={{
          stiffness: 150,
          damping: 19,
          mass: 1.2,
        }}
      >
        {DIMENSIONS[index]!}
      </TextMorph>
    </div>
  );
};

// Fixed, so the server and the first client paint agree; accrual is client-only.
export const DEPOSIT = 1204.42172398;
export const APY = 0.0418;
export const PER_SECOND = (DEPOSIT * APY) / 31_536_000;

const money = (value: number) =>
  value.toLocaleString("en", {
    // Eight fraction digits, because a per-second rate is invisible at two.
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });

export const Earned = () => {
  const [earned, setEarned] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const started = Date.now();
    const id = window.setInterval(
      () => setEarned(((Date.now() - started) / 1000) * PER_SECOND),
      120,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className={styles.splitItem}>
      <TextMorph
        ease={{
          stiffness: 150,
          damping: 19,
          mass: 1.2,
        }}
        className={`${styles.stage} ${styles.tabular}`}
      >
        {`$${money(DEPOSIT + earned)}`}
      </TextMorph>
      <span className={styles.caption}>4.18% APY · accruing every second</span>
    </div>
  );
};

export const PER_SEAT = 12;

export const Pricing = () => {
  const [seats, setSeats] = React.useState(7);

  return (
    <div className={styles.driven}>
      <div className={styles.drivenRow}>
        <TextMorph className={styles.stage}>
          {`${seats} ${seats === 1 ? "seat" : "seats"}`}
        </TextMorph>

        <TextMorph className={`${styles.stage} ${styles.tabular}`}>
          {`$${seats * PER_SEAT} / month`}
        </TextMorph>
      </div>

      <input
        className={styles.slider}
        type="range"
        min={1}
        max={40}
        value={seats}
        aria-label="Seats"
        onChange={(event) => setSeats(Number(event.target.value))}
      />
    </div>
  );
};
