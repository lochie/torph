import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
// Direct, not through the barrel: the header pulls this in on every page.
import { wrap } from "@/surfaces/demos/wrap";
import { mask } from "torph/plugins/mask";
import { classic } from "torph";

export const SpeechBubble = ({
  message,
  tail = "right",
}: {
  message: string;
  tail?: "left" | "right";
}) => {
  return (
    <div className={styles.container} data-tail={tail}>
      <TextMorph plugins={[mask({ stagger: 700 }), ...classic()]}>
        {wrap(message, 24)}
      </TextMorph>
    </div>
  );
};
