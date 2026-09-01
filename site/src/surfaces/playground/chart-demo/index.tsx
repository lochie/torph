"use client";

import React from "react";
import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";

const DATA = [
  { month: "Jan", value: 4120 },
  { month: "Feb", value: 3840 },
  { month: "Mar", value: 5230 },
  { month: "Apr", value: 4780 },
  { month: "May", value: 6150 },
  { month: "Jun", value: 5890 },
  { month: "Jul", value: 7240 },
  { month: "Aug", value: 6870 },
  { month: "Sep", value: 7590 },
  { month: "Oct", value: 8120 },
  { month: "Nov", value: 7430 },
  { month: "Dec", value: 9210 },
];

const MAX_VALUE = Math.max(...DATA.map((d) => d.value));

function formatValue(value: number): string {
  return "$" + value.toLocaleString("en-US");
}

export const ChartPlayground = () => {
  const [activeIndex, setActiveIndex] = React.useState(DATA.length - 1);

  return (
    <div className={styles.container}>
      <div className={styles.value}>
        <TextMorph>{formatValue(DATA[activeIndex].value)}</TextMorph>
      </div>
      <div className={styles.label}>
        Monthly revenue · {DATA[activeIndex].month}
      </div>
      <div className={styles.chart}>
        {DATA.map((item, i) => (
          <div
            key={item.month}
            className={`${styles.bar} ${i === activeIndex ? styles.active : ""}`}
            style={{ height: `${(item.value / MAX_VALUE) * 100}%` }}
            onMouseEnter={() => setActiveIndex(i)}
          />
        ))}
      </div>
      <div className={styles.months}>
        {DATA.map((item) => (
          <div key={item.month} className={styles.month}>
            {item.month}
          </div>
        ))}
      </div>
    </div>
  );
};
