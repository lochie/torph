import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { wrap } from "./wrap";
import { ResizeFrame } from "@/components/resize-frame";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const BODY = "Drag the handle to rewrap this sentence.";

// Content widths — the frame's cell is content-box, so padding is already out.
const MIN = 68;
const MAX = 208;

// Each stop is a width at which the text wraps differently.
const STOPS = [MAX, 140, MIN, 140];

export const ExampleResize = () => {
  const [width, setWidth] = React.useState(MAX);
  const [taken, setTaken] = React.useState(false);
  const [charWidth, setCharWidth] = React.useState(6.6);
  const reducedMotion = usePrefersReducedMotion();

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

  const maxChars = Math.max(8, Math.floor(width / charWidth));

  return (
    <div className={styles.resize}>
      <ResizeFrame
        className={styles.frame}
        label="Frame width"
        valueMin={MIN}
        valueMax={MAX}
        valueNow={width}
        keyStep={16}
        getWidth={() => width}
        onGrab={() => setTaken(true)}
        onResize={(next) => {
          setTaken(true);
          setWidth(Math.round(Math.min(MAX, Math.max(MIN, next))));
        }}
        cellStyle={{
          width,
          // Held off while dragging, or the frame lags the pointer.
          transition: `width ${taken ? 0 : 400}ms cubic-bezier(0.19, 1, 0.22, 1)`,
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
      </ResizeFrame>
    </div>
  );
};
