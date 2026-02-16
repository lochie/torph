import styles from "./styles.module.scss";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { TextMorph } from "torph/react";

const states = [
  {
    label: "Processing Action",
    icon: (
      <svg
        width="23"
        height="23"
        viewBox="0 0 23 23"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
        >
          <path
            d="M21.313 11.4062C21.313 16.8775 16.8777 21.3128 11.4065 21.3128"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            opacity="0.1"
            d="M11.4065 21.313C16.8777 21.313 21.313 16.8777 21.313 11.4065C21.313 5.93529 16.8777 1.5 11.4065 1.5C5.93529 1.5 1.5 5.93529 1.5 11.4065C1.5 16.8777 5.93529 21.313 11.4065 21.313Z"
            stroke="currentColor"
            strokeWidth="3"
          />
        </motion.g>
      </svg>
    ),
  },
  {
    label: "Action Complete",
    icon: (
      <svg
        width="21"
        height="21"
        viewBox="0 0 21 21"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20.9016 10.4508C20.9016 4.67899 16.2226 0 10.4508 0C4.67899 0 0 4.67899 0 10.4508C0 16.2226 4.67899 20.9016 10.4508 20.9016C16.2226 20.9016 20.9016 16.2226 20.9016 10.4508Z"
          fill="currentColor"
        />
        <path
          d="M6.09631 10.9828L8.83539 13.6439L14.8053 7.83789"
          fill="currentColor"
        />
        <path
          d="M6.09631 10.9828L8.83539 13.6439L14.8053 7.83789"
          stroke="black"
          strokeOpacity="0.85"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export const ExampleAction = () => {
  const [currentStateIndex, setCurrentStateIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStateIndex((prevIndex) => (prevIndex + 1) % states.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.action}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentStateIndex}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          {states[currentStateIndex].icon}
        </motion.div>
      </AnimatePresence>
      <TextMorph duration={400} ease="ease">
        {states[currentStateIndex].label}
      </TextMorph>
    </div>
  );
};
