import { useState } from "react";
import { useWebHaptics } from "web-haptics/react";

import styles from "./styles.module.scss";
import { TextMorph } from "torph/react";
import { CodeBlock } from "@/components/codeblock";

const pkgCmds = {
  npm: "npm i torph",
  pnpm: "pnpm i torph",
  yarn: "yarn add torph",
  bun: "bun i torph",
};

export const InstallCommands = () => {
  const [cmdIndex, setCmdIndex] = useState(0);
  const { trigger } = useWebHaptics();
  return (
    <div className={styles.install}>
      <div className={styles.commands}>
        {Object.keys(pkgCmds).map((cmd, i) => (
          <button
            key={cmd}
            onClick={() => {
              trigger("selection");
              setCmdIndex(i);
            }}
            data-active={i === cmdIndex}
          >
            {cmd}
          </button>
        ))}
      </div>
      <div className={styles.cmd}>
        <CodeBlock
          code={pkgCmds[Object.keys(pkgCmds)[cmdIndex] as keyof typeof pkgCmds]}
        >
          <span
            style={{
              opacity: 0.4,
              userSelect: "none",
            }}
          >
            {"$ "}
          </span>
          <TextMorph>
            {pkgCmds[Object.keys(pkgCmds)[cmdIndex] as keyof typeof pkgCmds]}
          </TextMorph>
        </CodeBlock>
      </div>
    </div>
  );
};
