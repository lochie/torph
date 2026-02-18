import { CSSProperties } from "react";
import styles from "./styles.module.scss";

export const Button = ({
  children,
  wide,
  ...props
}: {
  children: React.ReactNode;
  wide?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...props}
      className={styles.button}
      style={{ width: wide ? "100%" : "auto", ...props.style } as CSSProperties}
    >
      {children}
    </button>
  );
};
