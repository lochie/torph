import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMotionLoop } from "./use-motion-loop";

export const BRIGHTNESS = [72, 18, 94, 41, 63];

const MAX = 100;
const AUTOPLAY_MS = 1700;

const THUMB = 18; // The input's own thumb is sized to match, so both map a pointer alike

// A bob on a spring pinned to the thumb: how far it trails is how far it leans.
const STIFFNESS = 0.16;
const DAMPING = 0.67;
const MAX_TILT = 28;
const SOFT = 30; // px of trail at one radian of tanh — past it the lean saturates

const thumbX = (value: number, width: number) =>
  THUMB / 2 + (value / MAX) * Math.max(0, width - THUMB);

type Bob = { x: number; lag: number; vel: number };

const swing = (bob: Bob) => {
  bob.vel = (bob.vel + (bob.x - bob.lag) * STIFFNESS) * DAMPING;
  bob.lag += bob.vel;
};

const settled = (bob: Bob) =>
  Math.abs(bob.vel) < 0.02 && Math.abs(bob.x - bob.lag) < 0.05;

const tiltOf = (bob: Bob) => MAX_TILT * Math.tanh((bob.lag - bob.x) / SOFT);

const stretchOf = (bob: Bob) => Math.min(Math.abs(bob.vel) * 0.006, 0.13);

const bubbleTransform = (tilt: number, stretch: number, squash = 0) =>
  `translateX(-50%) rotate(${tilt}deg) scale(${(1 - stretch * 0.7) * (1 - squash)}, ${1 + stretch})`;

export const BubbleSlider = () => {
  const [value, setValue] = React.useState(BRIGHTNESS[0]!);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const trackRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const bubbleRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    bob: { x: 0, lag: 0, vel: 0 },
    value: BRIGHTNESS[0]!,
    width: 0,
  });

  const wake = useMotionLoop(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!track || !fill || !anchor || !bubble) return null;

    const s = state.current;
    s.width = track.offsetWidth;
    s.bob.x = thumbX(s.value, s.width);
    s.bob.lag = s.bob.x;

    return {
      step: () => {
        swing(s.bob);
        if (!settled(s.bob)) return true;
        s.bob.lag = s.bob.x;
        s.bob.vel = 0;
        return false;
      },
      paint: () => {
        anchor.style.transform = `translateX(${s.bob.x}px)`;
        bubble.style.transform = bubbleTransform(
          tiltOf(s.bob),
          stretchOf(s.bob),
        );
        fill.style.transform = `scaleX(${s.width ? s.bob.x / s.width : 0})`;
      },
    };
  });

  React.useEffect(() => {
    const s = state.current;
    s.value = value;
    s.bob.x = thumbX(value, s.width);
    if (reducedMotion) {
      s.bob.lag = s.bob.x;
      s.bob.vel = 0;
    }
    wake();
  }, [value, reducedMotion, wake]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(([entry]) => {
      const s = state.current;
      s.width = entry!.contentRect.width;
      s.bob.x = thumbX(s.value, s.width);
      // A reflow is not a drag — the bubble is carried, not thrown.
      s.bob.lag = s.bob.x;
      s.bob.vel = 0;
      wake();
    });
    observer.observe(track);

    return () => observer.disconnect();
  }, [wake]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % BRIGHTNESS.length;
      setValue(BRIGHTNESS[step]!);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  return (
    <div className={styles.bubbleSlider}>
      <div className={styles.bubbleTrack} ref={trackRef}>
        <div className={styles.bubbleFill} ref={fillRef} />

        <input
          className={styles.bubbleInput}
          type="range"
          min={0}
          max={MAX}
          value={value}
          aria-label="Value"
          aria-valuetext={`${value}%`}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (next !== value) trigger("selection");
            setTaken(true);
            setValue(next);
          }}
        />

        <div className={styles.bubbleAnchor} ref={anchorRef}>
          <span className={styles.bubbleThumb} />
          <div className={styles.bubble} ref={bubbleRef}>
            <TextMorph className={styles.bubbleValue}>{`${value}%`}</TextMorph>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SHOVE_GAP = 8; // Units held between the thumbs, so both stay grabbable

const SHOVE_PAD = 10; // px of clearance two bubbles want between them
const SHOVE_TILT = 22;
const SHOVE_STIFFNESS = 0.2;
const SHOVE_DAMPING = 0.62;

export const RangeShove = () => {
  const [range, setRange] = React.useState({ lo: 32, hi: 68 });
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const trackRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const loRef = React.useRef<HTMLDivElement>(null);
  const hiRef = React.useRef<HTMLDivElement>(null);
  const loBubbleRef = React.useRef<HTMLDivElement>(null);
  const hiBubbleRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    lo: { x: 0, lag: 0, vel: 0 },
    hi: { x: 0, lag: 0, vel: 0 },
    shove: 0,
    shoveVel: 0,
    range: { lo: 32, hi: 68 },
    width: 0,
  });

  const wake = useMotionLoop(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    const lo = loRef.current;
    const hi = hiRef.current;
    const loBubble = loBubbleRef.current;
    const hiBubble = hiBubbleRef.current;
    if (!track || !fill || !lo || !hi || !loBubble || !hiBubble) return null;

    const s = state.current;
    s.width = track.offsetWidth;
    s.lo.x = s.lo.lag = thumbX(s.range.lo, s.width);
    s.hi.x = s.hi.lag = thumbX(s.range.hi, s.width);

    return {
      step: () => {
        swing(s.lo);
        swing(s.hi);

        // What the pair would need to clear each other, against what they have.
        const need =
          (loBubble.offsetWidth + hiBubble.offsetWidth) / 2 + SHOVE_PAD;
        const target = Math.max(0, need - (s.hi.x - s.lo.x)) / need;
        s.shoveVel =
          (s.shoveVel + (target - s.shove) * SHOVE_STIFFNESS) * SHOVE_DAMPING;
        s.shove += s.shoveVel;

        return (
          !settled(s.lo) ||
          !settled(s.hi) ||
          Math.abs(s.shoveVel) > 0.001 ||
          Math.abs(target - s.shove) > 0.002
        );
      },
      paint: () => {
        const lean = SHOVE_TILT * s.shove;
        const squash = Math.min(Math.max(s.shove, 0), 1) * 0.16;

        lo.style.transform = `translateX(${s.lo.x}px)`;
        hi.style.transform = `translateX(${s.hi.x}px)`;
        loBubble.style.transform = bubbleTransform(
          tiltOf(s.lo) - lean,
          stretchOf(s.lo),
          squash,
        );
        hiBubble.style.transform = bubbleTransform(
          tiltOf(s.hi) + lean,
          stretchOf(s.hi),
          squash,
        );
        fill.style.transform = `translateX(${s.lo.x}px) scaleX(${
          s.width ? (s.hi.x - s.lo.x) / s.width : 0
        })`;
      },
    };
  });

  React.useEffect(() => {
    const s = state.current;
    s.range = range;
    s.lo.x = thumbX(range.lo, s.width);
    s.hi.x = thumbX(range.hi, s.width);
    if (reducedMotion) {
      s.lo.lag = s.lo.x;
      s.hi.lag = s.hi.x;
      s.lo.vel = s.hi.vel = 0;
    }
    wake();
  }, [range, reducedMotion, wake]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(([entry]) => {
      const s = state.current;
      s.width = entry!.contentRect.width;
      s.lo.x = s.lo.lag = thumbX(s.range.lo, s.width);
      s.hi.x = s.hi.lag = thumbX(s.range.hi, s.width);
      s.lo.vel = s.hi.vel = 0;
      wake();
    });
    observer.observe(track);

    return () => observer.disconnect();
  }, [wake]);

  const drag =
    (edge: "lo" | "hi") => (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      setRange((r) => {
        const bounded =
          edge === "lo"
            ? { lo: Math.min(next, r.hi - SHOVE_GAP), hi: r.hi }
            : { lo: r.lo, hi: Math.max(next, r.lo + SHOVE_GAP) };
        if (bounded.lo !== r.lo || bounded.hi !== r.hi) trigger("selection");
        return bounded;
      });
    };

  return (
    <div className={`${styles.bubbleSlider} ${styles.shoveStage}`}>
      <div
        className={`${styles.bubbleTrack} ${styles.shoveTrack}`}
        ref={trackRef}
      >
        <div className={styles.bubbleFill} ref={fillRef} />

        <input
          className={`${styles.bubbleInput} ${styles.shoveInput}`}
          type="range"
          min={0}
          max={MAX - SHOVE_GAP}
          value={range.lo}
          aria-label="Minimum"
          aria-valuetext={`$${range.lo}`}
          onChange={drag("lo")}
        />
        <input
          className={`${styles.bubbleInput} ${styles.shoveInput}`}
          type="range"
          min={SHOVE_GAP}
          max={MAX}
          value={range.hi}
          aria-label="Maximum"
          aria-valuetext={`$${range.hi}`}
          onChange={drag("hi")}
        />

        <div className={styles.bubbleAnchor} ref={loRef}>
          <span className={styles.bubbleThumb} />
          <div className={styles.bubble} ref={loBubbleRef}>
            <TextMorph
              className={styles.bubbleValue}
            >{`$${range.lo}`}</TextMorph>
          </div>
        </div>

        <div className={styles.bubbleAnchor} ref={hiRef}>
          <span className={styles.bubbleThumb} />
          <div className={styles.bubble} ref={hiBubbleRef}>
            <TextMorph
              className={styles.bubbleValue}
            >{`$${range.hi}`}</TextMorph>
          </div>
        </div>
      </div>

      <span className={styles.caption}>drag them together</span>
    </div>
  );
};
