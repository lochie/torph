import styles from "./styles.module.scss";

import { version } from "./../../../../packages/torph/package.json";
import Link from "next/link";

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.credits}>
        Crafted for the web by
        <a
          href="https://twitter.com/lochieaxon"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://lochie.me/avatar.jpg"
            alt=""
            width={20}
            height={20}
          />
          Lochie
        </a>
      </div>
      <div className={styles.details}>
        <span>v{version}</span>
        {" • "}
        <a
          href="https://github.com/lochie/torph"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        {" • "}
        <Link href="/examples">Examples</Link>
        {" • "}
        <Link href="/showcase">Showcase</Link>
        {" • "}
        <Link href="/playground">Playground</Link>
      </div>
    </footer>
  );
};
