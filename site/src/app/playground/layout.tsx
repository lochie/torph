"use client";

import { usePathname } from "next/navigation";
import styles from "./layout.module.scss";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const wide = pathname?.startsWith("/playground/tests");

  return (
    <div className={`${styles.container} ${wide ? styles.wide : ""}`}>
      {children}
    </div>
  );
}
