import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

// Simulating typing: showing intermediate states as if someone is typing
const typingSequence = [
  { value: "$", delay: 0 }, // Start typing
  { value: "$2", delay: 150 }, // Type 2
  { value: "$20", delay: 120 }, // Type 0
  { value: "$20", delay: 800 }, // Pause to read
  { value: "$", delay: 200 }, // Delete and start new
  { value: "$4", delay: 150 }, // Type 4
  { value: "$45", delay: 120 }, // Type 5
  { value: "$45.", delay: 180 }, // Type decimal
  { value: "$45.9", delay: 140 }, // Type 9
  { value: "$45.99", delay: 120 }, // Type 9
  { value: "$45.99", delay: 800 }, // Pause to read
  { value: "$", delay: 200 }, // Delete and start new
  { value: "$1", delay: 150 }, // Type 1
  { value: "$12", delay: 120 }, // Type 2
  { value: "$12.", delay: 180 }, // Type decimal
  { value: "$12.5", delay: 140 }, // Type 5
  { value: "$12.50", delay: 120 }, // Type 0
  { value: "$12.50", delay: 700 }, // Final pause
];

export const ExampleNumber = () => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const currentStep = typingSequence[currentIndex];
    const timeout = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % typingSequence.length);
    }, currentStep.delay);

    return () => clearTimeout(timeout);
  }, [currentIndex]);

  return (
    <div className={styles.number}>
      <TextMorph>{typingSequence[currentIndex].value}</TextMorph>
    </div>
  );
};
