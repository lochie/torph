import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

const states = [
  {
    prefix: "Buy for ",
    price: "$19.99",
    suffix: " / Month",
  },
  {
    prefix: "Buy for ",
    price: "$200",
    suffix: " / Year",
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
      <TextMorph>
        {states[currentStateIndex].prefix}
        {states[currentStateIndex].price}
        {states[currentStateIndex].suffix}
      </TextMorph>
    </div>
  );
};
