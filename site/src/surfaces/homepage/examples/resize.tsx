import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";

const copy = "Everything you need to ship faster";

// Slower than the default so the drag reads as deliberate. The same value
// drives the frame's width transition, so the two can't drift apart.
const DURATION = 600;

// A text box dragged narrower by the bar on its right edge. TextMorph's root is
// `white-space: nowrap`, so the line breaks are given to it explicitly.
const states = [
  { width: "100%", maxChars: 34 },
  { width: "67%", maxChars: 20 },
  { width: "48%", maxChars: 14 },
];

export const ExampleResize = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.resize}>
      <div
        className={styles.frame}
        style={{
          width: states[currentStateIndex].width,
          transitionDuration: `${DURATION}ms`,
        }}
      >
        <div className={styles.text}>
          <TextMorph duration={DURATION}>
            {wrap(copy, states[currentStateIndex].maxChars)}
          </TextMorph>
        </div>

        <span className={styles.bar} aria-hidden="true" />

        <span className={styles.cursor} aria-hidden="true">
          <svg
            width="16"
            height="10"
            viewBox="0 0 16 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.5 1.5L1 5L4.5 8.5M11.5 1.5L15 5L11.5 8.5"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
};
