import * as React from "react";

import styles from "./styles.module.scss";
import { AnimatePresence, motion } from "motion/react";
import { useClickOutside } from "@/hooks/useClickOutside";

export const Dropdown = ({
  children,
  options,
}: {
  children?: React.ReactNode;
  options: {
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    onClick: () => void;
  }[];
}) => {
  const [open, setOpen] = React.useState(false);

  const { ref } = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref} className={styles.container}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={styles.trigger}
      >
        {children}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{
            rotate: open ? -180 : 0,
          }}
          transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      <AnimatePresence mode="popLayout" initial={false}>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, scale: 0.95, originY: 0, originX: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className={styles.content}>
              {options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    option.onClick();
                    setOpen(false);
                  }}
                  disabled={option.disabled}
                >
                  {option.icon && (
                    <span className={styles.icon}>{option.icon}</span>
                  )}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
