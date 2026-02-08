import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

const states = [
  {
    label: "Buy for $19.99 / Month",
  },
  {
    label: "Buy for $200 / Year",
  },
];

export const ExamplePricing = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.button}>
      <TextMorph>{states[currentStateIndex].label}</TextMorph>
    </div>
  );
};
