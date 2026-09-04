import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SpeechBubble } from "@/components/speech-bubble";

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
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div className={styles.rewrite}>
      <SpeechBubble message={states[currentStateIndex].body} />

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
