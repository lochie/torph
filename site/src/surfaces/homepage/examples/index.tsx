import styles from "./styles.module.scss";

import { ExampleAction } from "./action";
import { ExampleCopy } from "./copy";
import { ExampleNumber } from "./number";
import { ExampleRewrite } from "./rewrite";

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
        <ExampleRewrite />
      </div>
      <div className={styles.example}>
        <ExampleNumber />
      </div>
    </div>
  );
};
