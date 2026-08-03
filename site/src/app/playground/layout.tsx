import type { Metadata } from "next";
import styles from "./layout.module.scss";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function PlaygroundLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.container}>{children}</div>;
}
