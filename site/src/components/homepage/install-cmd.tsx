import { useState } from "react";

import styles from "./styles.module.scss";
import { TextMorph } from "torph/react";

const pkgCmds = {
  npm: "npm i torph",
  pnpm: "pnpm i torph",
  yarn: "yarn add torph",
};

export const InstallCommands = () => {
  const [cmdIndex, setCmdIndex] = useState(0);
  return (
    <div className={styles.install}>
      <div className={styles.commands}>
        {Object.keys(pkgCmds).map((cmd, i) => (
          <button
            key={cmd}
            onClick={() => setCmdIndex(i)}
            data-active={i === cmdIndex}
          >
            {cmd}
          </button>
        ))}
      </div>
      <code>
        <TextMorph>
          {pkgCmds[Object.keys(pkgCmds)[cmdIndex] as keyof typeof pkgCmds]}
        </TextMorph>
      </code>
    </div>
  );
};
