import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const BODY = "Drag the handle to rewrap this sentence.";

// Horizontal padding on `.frame`, doubled — the width the text cannot use.
const PADDING = 28;
const MIN = 96;
const MAX = 236;

// Each stop is a width at which the text wraps differently.
const STOPS = [MAX, 168, MIN, 168];

export const ExampleResize = () => {
  const [width, setWidth] = React.useState(MAX);
  const [taken, setTaken] = React.useState(false);
  const [charWidth, setCharWidth] = React.useState(6.6);
  const reducedMotion = usePrefersReducedMotion();

  const frameRef = React.useRef<HTMLDivElement>(null);
  const rulerRef = React.useRef<HTMLSpanElement>(null);

  // Measured, so the wrap stays conservative enough never to outrun the box.
  React.useLayoutEffect(() => {
    const ruler = rulerRef.current;
    if (ruler) setCharWidth(ruler.getBoundingClientRect().width / BODY.length);
  }, []);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setWidth(STOPS[step % STOPS.length]!);
    }, 1900);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const drag = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    setTaken(true);
    const left = frame.getBoundingClientRect().left;
    setWidth(Math.round(Math.min(MAX, Math.max(MIN, clientX - left))));
  };

  const maxChars = Math.max(8, Math.floor((width - PADDING) / charWidth));

  return (
    <div className={styles.resize}>
      <div
        ref={frameRef}
        className={styles.frame}
        style={{
          width,
          // Held off while dragging, or the frame lags the pointer.
          transitionDuration: taken ? "0ms" : "400ms",
        }}
      >
        <TextMorph className={styles.text}>{wrap(BODY, maxChars)}</TextMorph>

        {/* Off-flow copy of the same string in the same font, measured once. */}
        <span
          ref={rulerRef}
          aria-hidden
          className={styles.text}
          style={{
            position: "absolute",
            visibility: "hidden",
            whiteSpace: "pre",
            pointerEvents: "none",
          }}
        >
          {BODY}
        </span>

        <span
          className={styles.bar}
          role="slider"
          tabIndex={0}
          aria-label="Frame width"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={width}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            drag(event.clientX);
          }}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowLeft"
                ? -16
                : event.key === "ArrowRight"
                  ? 16
                  : 0;
            if (!step) return;
            event.preventDefault();
            setTaken(true);
            setWidth((w) => Math.min(MAX, Math.max(MIN, w + step)));
          }}
        />

        <svg
          className={styles.cursor}
          viewBox="0 0 16 10"
          fill="none"
          aria-hidden
        >
          <path
            d="M4.5 1.5 1 5l3.5 3.5M11.5 1.5 15 5l-3.5 3.5M1.5 5H15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
