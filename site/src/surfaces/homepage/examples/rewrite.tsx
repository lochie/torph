import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";

const MAX_CHARS = 24;

// Edits land mid-sentence, so every word after them reflows to a new position —
// often onto a different line entirely.
const states = [
  {
    tone: "Professional",
    body: "I have reviewed the proposal and would be happy to proceed.",
  },
  {
    tone: "Friendly",
    body: "I read the proposal and I'm happy to get started.",
  },
  {
    tone: "Direct",
    // An em dash rather than a second full stop: a `.` ending two lines would
    // collide on segment id in multiline segmentation (see segment.ts).
    body: "Reviewed the proposal — happy to proceed.",
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
    <div className={styles.draft}>
      <div className={styles.to}>
        To
        <span>alex@acme.com</span>
      </div>

      <div className={styles.body}>
        <TextMorph>{wrap(states[currentStateIndex].body, MAX_CHARS)}</TextMorph>
      </div>

      <div className={styles.tone}>
        <svg
          width="12"
          height="12"
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
