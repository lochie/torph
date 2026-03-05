import { useState } from "react";
import { useWebHaptics } from "web-haptics/react";

import styles from "./styles.module.scss";
import { TextMorph } from "torph/react";
import { AutoResize } from "../auto-resizer";

export const CodeBlock = ({
  code,
  children,
}: {
  code: string;
  children?: React.ReactNode;
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { trigger } = useWebHaptics();

  return (
    <div className={styles.container}>
      <button
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
      <pre>
        <AutoResize>{children ?? code}</AutoResize>
      </pre>
    </div>
  );
};
