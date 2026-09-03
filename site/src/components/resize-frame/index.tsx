import styles from "./styles.module.scss";

import React from "react";

export type ResizeFrameProps = {
  children: React.ReactNode;
  label: string;
  valueMin: number;
  valueMax: number;
  valueNow: number;
  valueText?: string;
  keyStep?: number;
  // Read at grab time, so a caller animating width outside React still gets a live origin.
  getWidth: () => number;
  onResize: (width: number) => void;
  onGrab?: () => void;
  onRelease?: () => void;
  // Keyboard falls through to `onResize` unless a caller wants the step itself.
  onStep?: (delta: number) => void;
  cellRef?: React.Ref<HTMLDivElement>;
  cellStyle?: React.CSSProperties;
  className?: string;
};

export const ResizeFrame = ({
  children,
  label,
  valueMin,
  valueMax,
  valueNow,
  valueText,
  keyStep = 24,
  getWidth,
  onResize,
  onGrab,
  onRelease,
  onStep,
  cellRef,
  cellStyle,
  className,
}: ResizeFrameProps) => {
  const origin = React.useRef(0);

  return (
    <div className={[styles.frame, className].filter(Boolean).join(" ")}>
      <div ref={cellRef} className={styles.cell} style={cellStyle}>
        {children}
      </div>

      <span
        className={styles.grip}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        aria-valuetext={valueText}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          origin.current = event.clientX - getWidth();
          onGrab?.();
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          onResize(event.clientX - origin.current);
        }}
        onPointerUp={() => onRelease?.()}
        onPointerCancel={() => onRelease?.()}
        onKeyDown={(event) => {
          const delta =
            event.key === "ArrowLeft"
              ? -keyStep
              : event.key === "ArrowRight"
                ? keyStep
                : 0;
          if (!delta) return;
          event.preventDefault();
          if (onStep) onStep(delta);
          else onResize(getWidth() + delta);
        }}
      />
    </div>
  );
};
