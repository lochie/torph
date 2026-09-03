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

// A corner of its own, so he sits on the demo he came to look at rather than over it.
const ExampleCard = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.example}>{children}</div>;
};

export const Examples = () => {
  return (
    <div className={styles.examples}>
      {EXAMPLES.map((Example, i) => (
        <ExampleCard key={i}>
          <Example />
        </ExampleCard>
      ))}
    </div>
  );
};
