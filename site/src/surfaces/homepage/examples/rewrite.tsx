import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";

const MAX_CHARS = 24;

const states = [
  {
    tone: "Direct",
    body: "Running late, be there soon.",
  },
  {
    tone: "Friendly",
    body: "Running a bit behind, I'll be there soon.",
  },
  {
    tone: "Professional",
    body: "I'm running a little behind, should be there soon.",
  },
];

export const ExampleRewrite = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.rewrite}>
      <div className={styles.bubble}>
        <TextMorph>{wrap(states[currentStateIndex].body, MAX_CHARS)}</TextMorph>
      </div>

      <div className={styles.tone}>
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6 0.5L7.2 4.3L11 5.5L7.2 6.7L6 10.5L4.8 6.7L1 5.5L4.8 4.3L6 0.5Z"
            fill="currentColor"
          />
        </svg>
        <TextMorph>{states[currentStateIndex].tone}</TextMorph>
      </div>
    </div>
  );
};
