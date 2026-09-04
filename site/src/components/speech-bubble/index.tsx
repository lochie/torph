import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
// Direct, not through the barrel: the header pulls this in on every page.
import { wrap } from "@/surfaces/demos/wrap";

export const SpeechBubble = ({
  message,
  tail = "right",
}: {
  message: string;
  tail?: "left" | "right";
}) => {
  return (
    <div className={styles.container} data-tail={tail}>
      <TextMorph>{wrap(message, 24)}</TextMorph>
    </div>
  );
};
