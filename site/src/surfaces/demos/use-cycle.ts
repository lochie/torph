import React from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Reduced motion holds at index 0, so every sequence starts on a readable value.
export const useCycle = (length: number, interval: number) => {
  const [index, setIndex] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % length),
      interval,
    );
    return () => window.clearInterval(id);
  }, [length, interval, reducedMotion]);

  return index;
};
