import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";

const headline = "Text that moves with you";

// Each breakpoint re-wraps the same headline, so words migrate between lines
// as the viewport narrows instead of simply appearing or disappearing.
const states = [
  { width: "100%", maxChars: 28 },
  { width: "68%", maxChars: 18 },
  { width: "48%", maxChars: 12 },
];

export const ExampleResponsive = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.responsive}>
      <div
        className={styles.viewport}
        style={{ width: states[currentStateIndex].width }}
      >
        <div className={styles.chrome} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className={styles.headline}>
          <TextMorph>
            {wrap(headline, states[currentStateIndex].maxChars)}
          </TextMorph>
        </div>

        <div className={styles.lines} aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};
