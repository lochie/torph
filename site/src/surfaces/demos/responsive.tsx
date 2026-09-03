import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Two are the same sentence at a different measure; the third drops a clause.
const BREAKPOINTS = [
  { width: "13.5rem", chars: 26, body: "Ship faster with fewer bugs" },
  { width: "9.5rem", chars: 17, body: "Ship faster with fewer bugs" },
  { width: "7rem", chars: 12, body: "Ship faster" },
];

export const ExampleResponsive = () => {
  const [index, setIndex] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % BREAKPOINTS.length),
      2100,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const breakpoint = BREAKPOINTS[index]!;

  return (
    <div className={styles.responsive}>
      <div className={styles.viewport} style={{ width: breakpoint.width }}>
        <div className={styles.chrome} aria-hidden>
          <span />
          <span />
          <span />
        </div>

        <TextMorph className={styles.headline}>
          {wrap(breakpoint.body, breakpoint.chars)}
        </TextMorph>

        <div className={styles.lines} aria-hidden>
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};
