import React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * The examples on this page advance themselves on a timer and never stop, which
 * is the auto-updating motion a reader who has asked for less of it wants held
 * still — and the same query torph itself honours by default.
 *
 * Reported as false on the server and for the first client paint, so the markup
 * matches across hydration; the real answer arrives on the frame after.
 */
export const usePrefersReducedMotion = (): boolean =>
  React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
