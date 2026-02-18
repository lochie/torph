import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

const states = [
  {
    label: "Copy",
  },
  {
    label: "Copied",
  },
];

export const ExampleCopy = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.codeblock}>
      <TextMorph>{states[currentStateIndex].label}</TextMorph>
    </div>
  );
};
