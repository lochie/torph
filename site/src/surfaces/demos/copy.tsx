import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { blur } from "torph/plugins/blur";
import { classic } from "torph";

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
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div className={styles.codeblock}>
      <TextMorph plugins={[blur(), ...classic()]}>
        {states[currentStateIndex].label}
      </TextMorph>
    </div>
  );
};
