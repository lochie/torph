import React from "react";

const FRAME = 1000 / 60;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export type Motion = {
  /** One fixed step. `false` parks the loop until the next `wake()`. */
  step: () => boolean;
  paint: () => void;
};

// Fixed-step, so a 120Hz display integrates the same as a 60Hz one, and parked
// between gestures rather than holding a frame loop open for a demo at rest.
export const useMotionLoop = (setup: () => Motion | null) => {
  // Read once, on mount: everything it closes over that changes lives in a ref.
  const setupRef = React.useRef(setup);
  const wakeRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    const motion = setupRef.current();
    if (!motion) return;

    let raf = 0;
    let last = 0;
    let acc = 0;
    let moving = true;

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), 120);
      last = now;

      while (acc >= FRAME) {
        moving = motion.step();
        acc -= FRAME;
      }

      motion.paint();
      raf = moving ? requestAnimationFrame(frame) : 0;
    };

    wakeRef.current = () => {
      moving = true;
      if (raf) return;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    };

    wakeRef.current();

    return () => {
      wakeRef.current = () => {};
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return React.useCallback(() => wakeRef.current(), []);
};
