import styles from "./styles.module.scss";

import { ExampleAnalyzingTransaction } from "./analyzing-transaction";
import { ExamplePricing } from "./pricing";
import { ExampleCopy } from "./copy";

export const Examples = () => {
  return (
    <div className={styles.examples}>
      <div className={styles.example}>
        <ExampleAnalyzingTransaction />
      </div>
      <div className={styles.example}>
        <ExamplePricing />
      </div>
      <div className={styles.example}>
        <ExampleCopy />
      </div>
      <div className={styles.example}>
        <ExampleAnalyzingTransaction />
      </div>
    </div>
  );
};
