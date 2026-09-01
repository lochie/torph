import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

const sequence = [
  // Type $20
  { value: "$", cursor: 1, delay: 0 },
  { value: "$2", cursor: 2, delay: 150 },
  { value: "$20", cursor: 3, delay: 1200 },
  { value: "$20", cursor: 3, delay: 1800 },

  // Move cursor before 2, then insert 1 → $120
  { value: "$20", cursor: 1, delay: 200 },
  { value: "$420", cursor: 2, delay: 400 },
  { value: "$4,020", cursor: 4, delay: 1800 },

  // Move cursor between 1 and 2, then insert . → $1.20
  { value: "$420", cursor: 2, delay: 400 },
  { value: "$4.20", cursor: 3, delay: 400 },
  { value: "$4.20", cursor: 3, delay: 1800 },

  { value: "$4.20", cursor: 5, delay: 1800 },
  { value: "$4.2", cursor: 4, delay: 200 },
  { value: "$4", cursor: 2, delay: 200 },
  { value: "$", cursor: 1, delay: 200 },
];

export const ExampleNumber = () => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const step = sequence[currentIndex];
    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % sequence.length);
    }, step.delay);

    return () => clearTimeout(timeout);
  }, [currentIndex]);

  const step = sequence[currentIndex];
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [cursorX, setCursorX] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (measureRef.current && containerRef.current) {
      const measureRect = measureRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setCursorX(measureRect.right - containerRect.left);
    }
  }, [currentIndex]);

  return (
    <div className={styles.number}>
      <div ref={containerRef} style={{ position: "relative" }}>
        <TextMorph cursorIndex={step.cursor}>{step.value}</TextMorph>
        <span
          ref={measureRef}
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            visibility: "hidden",
            whiteSpace: "pre",
            font: "inherit",
          }}
        >
          {step.value.slice(0, step.cursor)}
        </span>
        <span
          className={styles.cursor}
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            left: cursorX != null ? `${cursorX}px` : undefined,
          }}
        />
      </div>
    </div>
  );
};
