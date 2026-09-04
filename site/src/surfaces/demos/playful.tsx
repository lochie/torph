import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clamp, useMotionLoop } from "./use-motion-loop";

// ── A dial you flick ──

export const DIAL_MAX = 500;

const STEP_DEG = 7; // One unit of value per this much turn
const DIAL_SPAN = DIAL_MAX * STEP_DEG;
const FRICTION = 0.955;
const DETENT_VEL = 1.2; // Below this it stops coasting and homes to a notch
const DETENT_STIFFNESS = 0.22;
const DETENT_DAMPING = 0.6;
const BOUNCE = -0.4;
const FLICK = 26; // deg/frame, the nudge that shows a spin-down without a pointer

const pointerAngle = (event: React.PointerEvent, element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return (
    (Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2),
    ) *
      180) /
    Math.PI
  );
};

export const SpinDial = ({
  duration,
  ease,
}: {
  duration?: number;
  ease?: string | object;
}) => {
  const [value, setValue] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const dialRef = React.useRef<HTMLDivElement>(null);
  const faceRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    angle: 0,
    vel: 0,
    grabbed: false,
    pointer: 0,
    value: 0,
    reduced: false,
  });

  const wake = useMotionLoop(() => {
    const face = faceRef.current;
    if (!face) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.grabbed) return true;

        if (s.reduced) {
          s.angle =
            clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX) * STEP_DEG;
          s.vel = 0;
          return false;
        }

        if (Math.abs(s.vel) > DETENT_VEL) {
          s.vel *= FRICTION;
          s.angle += s.vel;
          if (s.angle < 0 || s.angle > DIAL_SPAN) {
            s.angle = clamp(s.angle, 0, DIAL_SPAN);
            s.vel *= BOUNCE;
          }
          return true;
        }

        // Homing to the nearest notch is what makes a flick land rather than drift.
        const notch =
          clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX) * STEP_DEG;
        s.vel = (s.vel + (notch - s.angle) * DETENT_STIFFNESS) * DETENT_DAMPING;
        s.angle += s.vel;

        if (Math.abs(s.vel) < 0.01 && Math.abs(notch - s.angle) < 0.05) {
          s.angle = notch;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        face.style.transform = `rotate(${s.angle}deg)`;

        const next = clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX);
        if (next === s.value) return;
        // Only while it is slow enough to feel — a spin-down would be a firehose.
        if (s.grabbed || Math.abs(s.vel) < DETENT_VEL) trigger("selection");
        s.value = next;
        setValue(next);
      },
    };
  });

  React.useEffect(() => {
    state.current.reduced = reducedMotion;
    if (reducedMotion) return;
    state.current.vel = FLICK;
    wake();
  }, [reducedMotion, wake]);

  const nudge = (units: number) => {
    const s = state.current;
    s.angle = clamp(s.value + units, 0, DIAL_MAX) * STEP_DEG;
    s.vel = 0;
    wake();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -25,
      PageUp: 25,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    nudge(step);
  };

  return (
    <div className={styles.dialStage}>
      <div
        className={styles.dial}
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-label="Goal"
        aria-valuemin={0}
        aria-valuemax={DIAL_MAX}
        aria-valuenow={value}
        aria-valuetext={`$${value}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          const dial = dialRef.current;
          if (!dial) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const s = state.current;
          s.grabbed = true;
          s.pointer = pointerAngle(event, dial);
          s.vel = 0;
          wake();
        }}
        onPointerMove={(event) => {
          const dial = dialRef.current;
          const s = state.current;
          if (!dial || !s.grabbed) return;
          const angle = pointerAngle(event, dial);
          // atan2 wraps at ±180; the short way round is always the one turned.
          let delta = angle - s.pointer;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          s.pointer = angle;
          s.angle = clamp(s.angle + delta, 0, DIAL_SPAN);
          s.vel = s.vel * 0.6 + delta * 0.4;
        }}
        onPointerUp={() => {
          state.current.grabbed = false;
          wake();
        }}
        onPointerCancel={() => {
          state.current.grabbed = false;
          wake();
        }}
      >
        <div className={styles.dialFace} ref={faceRef} />
        <TextMorph
          ease={ease}
          duration={duration}
          className={styles.dialValue}
        >{`$${value}`}</TextMorph>
      </div>
    </div>
  );
};

// ── A chip you pull ──

export const PULL_MIN = -199;
export const PULL_MAX = 999;

const PULL_LIMIT = 74; // px of travel before the rubber band saturates
const PULL_RATE = 30; // units per second at a full pull
const PULL_STIFFNESS = 0.3;
const PULL_DAMPING = 0.55;
const HELLO = 34; // px of nudge on mount, so it wobbles without counting

const signed = (value: number) =>
  value < 0 ? `−${Math.abs(value)}` : `${value}`;

export const PullToCount = () => {
  const [value, setValue] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const chipRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    offset: 0,
    vel: 0,
    grabbed: false,
    from: 0,
    count: 0,
    value: 0,
    reduced: false,
  });

  const wake = useMotionLoop(() => {
    const chip = chipRef.current;
    if (!chip) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.grabbed) {
          // Quadratic, so a short pull stays precise and a long one flies.
          const pull = s.offset / PULL_LIMIT;
          s.count = clamp(
            s.count + (Math.sign(pull) * pull * pull * PULL_RATE) / 60,
            PULL_MIN,
            PULL_MAX,
          );
          return true;
        }

        if (s.reduced) {
          s.offset = 0;
          s.vel = 0;
          return false;
        }

        s.vel = (s.vel - s.offset * PULL_STIFFNESS) * PULL_DAMPING;
        s.offset += s.vel;

        if (Math.abs(s.vel) < 0.05 && Math.abs(s.offset) < 0.1) {
          s.offset = 0;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        const t = Math.abs(s.offset) / PULL_LIMIT;
        chip.style.transform = `translateX(${s.offset}px) scale(${1 + t * 0.22}, ${1 - t * 0.13})`;

        const next = Math.round(s.count);
        if (next === s.value) return;
        s.value = next;
        setValue(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    state.current.reduced = reducedMotion;
    if (reducedMotion) return;
    state.current.offset = HELLO;
    wake();
  }, [reducedMotion, wake]);

  const nudge = (units: number) => {
    const s = state.current;
    s.count = clamp(s.count + units, PULL_MIN, PULL_MAX);
    s.value = Math.round(s.count);
    setValue(s.value);
    trigger("selection");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -25,
      PageUp: 25,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    nudge(step);
  };

  return (
    <div className={styles.pull}>
      <div className={styles.pullTrack}>
        <div className={styles.pullRail} aria-hidden>
          <span className={styles.pullNotch} />
        </div>

        <div
          className={styles.pullChip}
          ref={chipRef}
          role="spinbutton"
          tabIndex={0}
          aria-label="Quantity"
          aria-valuemin={PULL_MIN}
          aria-valuemax={PULL_MAX}
          aria-valuenow={value}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const s = state.current;
            s.grabbed = true;
            s.from = event.clientX - s.offset;
            s.vel = 0;
            s.count = s.value;
            wake();
          }}
          onPointerMove={(event) => {
            const s = state.current;
            if (!s.grabbed) return;
            const raw = event.clientX - s.from;
            // Rubber band: past the limit the pull keeps giving, the travel does not.
            s.offset = PULL_LIMIT * Math.tanh(raw / PULL_LIMIT);
          }}
          onPointerUp={() => {
            state.current.grabbed = false;
            wake();
          }}
          onPointerCancel={() => {
            state.current.grabbed = false;
            wake();
          }}
        >
          <TextMorph className={styles.pullValue}>{signed(value)}</TextMorph>
        </div>
      </div>
    </div>
  );
};
