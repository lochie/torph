import styles from "./styles.module.scss";

import { wrap } from "./utils";
import { TextMorph } from "torph/react";

export const SpeechBubble = ({
  message,
  tail = "right",
}: {
  message: string;
  tail?: "left" | "right";
}) => {
  return (
    <div className={styles.container} data-tail={tail}>
      <TextMorph>{wrap(message, 32)}</TextMorph>
    </div>
  );
};
