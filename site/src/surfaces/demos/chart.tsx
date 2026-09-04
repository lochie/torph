import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Climbs and dips, so the scrub has something to do at every place value.
const DATA = [
  { month: "January", value: 4120 },
  { month: "February", value: 3840 },
  { month: "March", value: 5230 },
  { month: "April", value: 4780 },
  { month: "May", value: 6150 },
  { month: "June", value: 5890 },
  { month: "July", value: 7240 },
  { month: "August", value: 6870 },
  { month: "September", value: 7590 },
  { month: "October", value: 8120 },
  { month: "November", value: 7430 },
  { month: "December", value: 9210 },
];

const MAX = Math.max(...DATA.map((d) => d.value));
const LAST = DATA.length - 1;

const clamp = (index: number) => Math.min(LAST, Math.max(0, index));

// Autoplays until touched, then hands over rather than fighting the pointer.
export const ExampleChart = () => {
  const [active, setActive] = React.useState(LAST);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % DATA.length),
      1100,
    );
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const scrub = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    setTaken(true);
    setActive(clamp(Math.floor(ratio * DATA.length)));
  };

  const step = (delta: number) => {
    setTaken(true);
    setActive((i) => clamp(i + delta));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      ArrowDown: () => step(-1),
      ArrowUp: () => step(1),
      Home: () => {
        setTaken(true);
        setActive(0);
      },
      End: () => {
        setTaken(true);
        setActive(LAST);
      },
    };

    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  const current = DATA[active]!;

  return (
    <div className={styles.chart}>
      <div className={styles.readout}>
        <TextMorph
          ease={{
            stiffness: 150,
            damping: 19,
            mass: 1.2,
          }}
          className={styles.amount}
        >
          {`$${current.value.toLocaleString("en")}`}
        </TextMorph>
        <span className={styles.caption}>
          <TextMorph duration={100}>{current.month} revenue</TextMorph>
        </span>
      </div>

      <div
        className={styles.bars}
        role="slider"
        tabIndex={0}
        aria-label="Month"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={active}
        aria-valuetext={`${current.month}, $${current.value.toLocaleString("en")}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => scrub(e.clientX, e.currentTarget)}
        // Touch drags belong to the card scroller; a finger selects on tap.
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          scrub(e.clientX, e.currentTarget);
        }}
      >
        {DATA.map((item, i) => (
          <span
            key={item.month}
            aria-hidden
            className={`${styles.bar} ${i === active ? styles.barActive : ""}`}
            style={{ height: `${(item.value / MAX) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};
