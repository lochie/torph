import React from "react";
import styles from "./styles.module.scss";

/**
 * Holds each new morph inside `target` at its start and lets the slider walk it
 * from a to b. Held animations stay paused, so they never finish — exiting
 * characters are not removed out from under the scrub. Turning it off plays
 * everything on to the end.
 */
export function Scrubber({
  target,
  duration,
}: {
  target: React.RefObject<HTMLElement | null>;
  duration: number;
}) {
  const [on, setOn] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const held = React.useRef(new Set<Animation>());

  React.useEffect(() => {
    if (!on) return;
    const holding = held.current;
    let frame = 0;
    // WAAPI has no "animation started" event, so new morphs are found by polling.
    const watch = () => {
      const started = (
        target.current?.getAnimations({ subtree: true }) ?? []
      ).filter((a) => a.playState === "running");
      if (started.length > 0) {
        // A new morph replaces the one being scrubbed; let the old one land.
        holding.forEach((a) => a.playState !== "idle" && a.finish());
        holding.clear();
        for (const a of started) {
          a.pause();
          a.currentTime = 0;
          holding.add(a);
        }
        setTime(0);
      }
      frame = requestAnimationFrame(watch);
    };
    watch();
    return () => {
      cancelAnimationFrame(frame);
      holding.forEach((a) => a.playState !== "idle" && a.play());
      holding.clear();
    };
  }, [on, target]);

  const scrub = (next: number) => {
    setTime(next);
    held.current.forEach((a) => {
      if (a.playState !== "idle") a.currentTime = next;
    });
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${on ? styles.btnActive : ""}`}
        onClick={() => setOn((o) => !o)}
        title="Hold each morph at its start and scrub it by hand"
      >
        Scrub
      </button>
      {on && (
        <label className={styles.range} title="Time into the morph">
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.min(time, duration)}
            onChange={(e) => scrub(Number(e.target.value))}
          />
          <code>{Math.round(time)}ms</code>
        </label>
      )}
    </>
  );
}
