import styles from "./styles.module.scss";

import { ExampleAction } from "./action";
import { ExamplePricing } from "./pricing";
import { ExampleCopy } from "./copy";
import { ExampleNumber } from "./number";

export const Examples = () => {
  return (
    <div className={styles.examples}>
      <div className={styles.example}>
        <ExampleAction />
      </div>
      <div className={styles.example}>
        <ExampleCopy />
      </div>
      <div className={styles.example}>
        <ExamplePricing />
      </div>
      <div className={styles.example}>
        <ExampleNumber />
      </div>
    </div>
  );
};
