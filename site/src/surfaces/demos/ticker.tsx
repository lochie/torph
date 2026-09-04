import styles from "./card.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const BASELINE = 7240;

const WINDOW = 20; // Slots across the visible box
const POINTS = WINDOW + 2; // A spare at each end: the sample arriving, the one leaving
const SLOT = 100 / WINDOW; // viewBox units per slot
const SLOT_MS = 420; // One slot's travel — the scroll speed, and the sampling rate

// A shape rather than random values, so server and first client render agree.
const SEED = Array.from({ length: POINTS }, (_, i) =>
  Math.round(BASELINE + Math.sin(i / 2.4) * 620 + Math.sin(i / 1.1) * 260),
);

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${Math.round(value)}`;

const percent = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

// A Catmull-Rom spline: at this size a corner per sample reads as noise.
const spark = (values: number[], min: number, max: number) => {
  const span = max - min || 1;
  const y = (i: number) =>
    30 -
    ((values[Math.min(Math.max(i, 0), values.length - 1)] - min) / span) * 28;

  let d = `M0 ${y(0).toFixed(2)}`;

  for (let i = 0; i < values.length - 1; i += 1) {
    const x = i * SLOT;
    // Spacing is uniform, so only the control points' heights vary.
    const c1 = y(i) + (y(i + 1) - y(i - 1)) / 6;
    const c2 = y(i + 1) - (y(i + 2) - y(i)) / 6;

    d +=
      ` C${(x + SLOT / 3).toFixed(2)} ${c1.toFixed(2)}` +
      ` ${(x + (SLOT * 2) / 3).toFixed(2)} ${c2.toFixed(2)}` +
      ` ${(x + SLOT).toFixed(2)} ${y(i + 1).toFixed(2)}`;
  }

  return d;
};

// Fraction of the remaining distance to cover in `dt`ms, at time constant `tau`.
const chase = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

// Closed back along the baseline, for the wash underneath.
const area = (line: string) =>
  `${line} L${((POINTS - 1) * SLOT).toFixed(2)} 32 L0 32 Z`;

// Least-squares slope across the window, as a fraction of the drawn height.
const trend = (values: number[], min: number, max: number) => {
  const mid = (values.length - 1) / 2;
  let num = 0;
  let den = 0;

  for (let i = 0; i < values.length; i += 1) {
    num += (i - mid) * values[i];
    den += (i - mid) ** 2;
  }

  return ((num / den) * (values.length - 1)) / (max - min || 1);
};

const TREND_GAIN = 1.6; // Slope worth full colour, set from the walk's spread

const RISING = [74, 222, 128];
const FALLING = [255, 107, 107];

// Through white, not straight across — a red-to-green ramp passes through mud.
const tint = (value: number) => {
  const to = value > 0 ? RISING : FALLING;
  const k = Math.min(Math.abs(value) * TREND_GAIN, 1);

  return `rgb(${to.map((c) => Math.round(255 + (c - 255) * k)).join(", ")})`;
};

const SEED_MIN = Math.min(...SEED);
const SEED_MAX = Math.max(...SEED);
const SEED_LINE = spark(SEED, SEED_MIN, SEED_MAX);
const SEED_TINT = tint(trend(SEED, SEED_MIN, SEED_MAX));

// The sample interval is shorter than the default duration on purpose: each
// update lands on the morph before it and picks up from where it got to.
export const ExampleTicker = () => {
  const [stats, setStats] = React.useState({
    requests: BASELINE,
    change: 12.4,
  });
  const reducedMotion = usePrefersReducedMotion();
  // Legal in a fragment reference, but not for anything reading it as a selector.
  const fillId = React.useId().replace(/:/g, "");

  const groupRef = React.useRef<SVGGElement>(null);
  const lineRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  // Set directly, not via currentColor — that has a history of not repainting.
  const washTopRef = React.useRef<SVGStopElement>(null);
  const washFootRef = React.useRef<SVGStopElement>(null);

  // Not React state: re-rendering the card every frame would drag both morphs.
  const chart = React.useRef({
    values: [...SEED],
    value: BASELINE,
    min: SEED_MIN,
    max: SEED_MAX,
    samples: 0,
    trend: trend(SEED, SEED_MIN, SEED_MAX),
  });

  React.useEffect(() => {
    if (reducedMotion) return;

    let frame = 0;
    let last = performance.now();
    let carry = 0;
    let drift = 0;
    let changeDrift = 0;
    let painted = ""; // Three attributes ride on this: cheaper to compare than write

    const sample = () => {
      const state = chart.current;

      // Most of the last step carries into this one, so the series moves in runs
      // rather than reversing on every sample and drawing a zigzag.
      drift = drift * 0.72 + (Math.random() - 0.5) * 0.02;

      state.value = Math.max(
        950,
        Math.round(
          state.value * (1 + drift) +
            // Pulled back to the baseline, so the series wanders inside a band.
            (BASELINE - state.value) * 0.04,
        ),
      );
      state.values = [...state.values.slice(1), state.value];
      state.samples += 1;

      // Half the rate: a figure changing every 420ms is unreadable.
      if (state.samples % 2 === 0) {
        // Smoothed twice, so the value arcs and actually crosses zero — the sign
        // flipping under the morph is the half of this stat worth watching.
        changeDrift = changeDrift * 0.8 + (Math.random() - 0.5) * 1.6;

        setStats((prev) => ({
          requests: state.value,
          change: prev.change * 0.9 + changeDrift,
        }));
      }
    };

    const draw = (now: number) => {
      const state = chart.current;
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dt = Math.min(now - last, 64);
      carry += now - last;
      last = now;

      while (carry >= SLOT_MS) {
        carry -= SLOT_MS;
        sample();
      }

      const lo = Math.min(...state.values);
      const hi = Math.max(...state.values);

      // Outward briskly, inward gently. The new sample spends a slot beyond the
      // right edge before it is visible, so easing outward cannot clip the line.
      state.min += (lo - state.min) * chase(dt, lo < state.min ? 140 : 800);
      state.max += (hi - state.max) * chase(dt, hi > state.max ? 140 : 800);

      // Eased too: stepping the tint once a sample would read as a flicker.
      state.trend +=
        (trend(state.values, state.min, state.max) - state.trend) *
        chase(dt, 500);

      const next = tint(state.trend);

      if (next !== painted) {
        painted = next;
        lineRef.current?.setAttribute("stroke", next);
        washTopRef.current?.setAttribute("stop-color", next);
        washFootRef.current?.setAttribute("stop-color", next);
      }

      const line = spark(state.values, state.min, state.max);
      lineRef.current?.setAttribute("d", line);
      areaRef.current?.setAttribute("d", area(line));

      // Linear. A landing sample shifts the array left as this resets, on the
      // same frame — the two cancel exactly, so the scroll has no seam.
      groupRef.current?.setAttribute(
        "transform",
        `translate(${(-(carry / SLOT_MS) * SLOT).toFixed(3)} 0)`,
      );

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  return (
    <div className={styles.ticker}>
      <svg
        className={styles.spark}
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop
              ref={washTopRef}
              offset="0%"
              stopColor={SEED_TINT}
              stopOpacity="0.14"
            />
            <stop
              ref={washFootRef}
              offset="100%"
              stopColor={SEED_TINT}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Clipped at both ends, so a new sample scrolls in rather than appearing. */}
        <g ref={groupRef} transform="translate(0 0)">
          <path ref={areaRef} d={area(SEED_LINE)} fill={`url(#${fillId})`} />
          <path
            ref={lineRef}
            d={SEED_LINE}
            fill="none"
            stroke={SEED_TINT}
            // Under this the tint reads closer to grey than to either colour.
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            // The viewBox is stretched, so the stroke reads thinner across than down.
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <TextMorph className={styles.statValue}>
            {compact(stats.requests)}
          </TextMorph>
          <span className={styles.caption}>Requests / min</span>
        </div>

        <div className={styles.stat}>
          <TextMorph
            className={styles.statValue}
            style={{ color: stats.change < 0 ? "#ff6b6b" : "#4ade80" }}
            ease={{
              stiffness: 150,
              damping: 19,
              mass: 1.2,
            }}
          >
            {percent(stats.change)}
          </TextMorph>
          <span className={styles.caption}>vs. last week</span>
        </div>
      </div>
    </div>
  );
};
