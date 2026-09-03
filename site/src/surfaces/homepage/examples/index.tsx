import styles from "./styles.module.scss";

import {
  ExampleAction,
  ExampleChart,
  ExampleCopy,
  ExampleNumber,
  ExampleRewrite,
  ExampleTicker,
} from "@/surfaces/demos";

// Alternating text and numbers, so neither half reads as an afterthought.
const EXAMPLES = [
  ExampleAction,
  ExampleChart,
  ExampleRewrite,
  ExampleTicker,
  ExampleCopy,
  ExampleNumber,
];

export const Examples = () => {
  return (
    <div className={styles.examples}>
      {EXAMPLES.map((Example, i) => (
        <div key={i} className={styles.example}>
          <Example />
        </div>
      ))}
    </div>
  );
};
