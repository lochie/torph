"use client";

import { usePathname } from "next/navigation";
import styles from "./layout.module.scss";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  // The test bench is a two-column workspace — the 40rem reading measure the
  // other playground pages use leaves the morph stage unusably narrow.
  const wide = pathname?.startsWith("/playground/tests");

  return (
    <div className={`${styles.container} ${wide ? styles.wide : ""}`}>
      {children}
    </div>
  );
}
