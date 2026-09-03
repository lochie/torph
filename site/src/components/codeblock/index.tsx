import { useState } from "react";
import { useWebHaptics } from "web-haptics/react";

import styles from "./styles.module.scss";
import { TextMorph } from "torph/react";
import { useMascotSpot } from "@/components/mascot/spots";

export const CodeBlock = ({
  code,
  children,
}: {
  code: string;
  children?: React.ReactNode;
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { trigger } = useWebHaptics();

  // Beside the button, not on it: a line of code never reaches that far right.
  const spot = useMascotSpot<HTMLButtonElement>({
    side: "left",
    says: isCopied ? "Have fun!" : "",
  });

  return (
    <div className={styles.container}>
      <button
        ref={spot}
        className={styles.copy}
        onClick={() => {
          if (code) {
            setIsCopied(true);
            navigator.clipboard.writeText(code.toString());
            trigger("success");
            setTimeout(() => {
              setIsCopied(false);
            }, 2000);
          }
        }}
      >
        <TextMorph>{isCopied ? `Copied` : `Copy`}</TextMorph>
      </button>
      <pre>{children ?? code}</pre>
    </div>
  );
};
