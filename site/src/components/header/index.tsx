import Link from "next/link";
import styles from "./styles.module.scss";

export const Header = () => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <Link href="/">
          <h1>&lt;TextMorph /&gt;</h1>
        </Link>
        <p>Text continuity for interfaces on the web.</p>
      </div>
    </div>
  );
};
