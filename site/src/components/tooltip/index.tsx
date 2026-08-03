import { useState, useRef, useLayoutEffect } from "react";
import styles from "./styles.module.scss";

export const Tooltip = ({
  children,
  content,
  position = "top",
  delay = 300,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: "top" | "bottom";
  delay?: number;
}) => {
  const [visible, setVisible] = useState(false);
  const [nudge, setNudge] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!visible || !tipRef.current) return;
    const rect = tipRef.current.getBoundingClientRect();
    const pad = 8;
    if (rect.left < pad) setNudge(pad - rect.left);
    else if (rect.right > window.innerWidth - pad)
      setNudge(window.innerWidth - pad - rect.right);
    else setNudge(0);
  }, [visible]);

  const show = () => {
    clearTimeout(timeoutRef.current!);
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    clearTimeout(timeoutRef.current!);
    setVisible(false);
    setNudge(0);
  };

  return (
    <div
      ref={wrapperRef}
      className={styles.tooltip}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          ref={tipRef}
          className={`${styles.tooltipContent} ${styles[position]}`}
          style={{ transform: `translateX(calc(-50% + ${nudge}px))` }}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
