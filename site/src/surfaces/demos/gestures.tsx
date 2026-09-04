import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clamp, useMotionLoop } from "./use-motion-loop";

// ── A wheel you flick ──

export const SPEEDS = [
  { name: "Standard", arrives: "Arrives Friday" },
  { name: "Express", arrives: "Arrives Wednesday" },
  { name: "Priority", arrives: "Arrives tomorrow" },
  { name: "Overnight", arrives: "Arrives 8am tomorrow" },
  { name: "Same day", arrives: "Arrives before 6pm" },
];

const ITEM_H = 36;
const WHEEL_FRICTION = 0.94;
const WHEEL_DETENT = 0.6; // px/frame below which it homes to a row
const WHEEL_STIFFNESS = 0.22;
const WHEEL_DAMPING = 0.62;
const WHEEL_BOUNCE = -0.35;
const WHEEL_FLICK = 4.6;

export const WheelPicker = () => {
  const [index, setIndex] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const stripRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    y: 0,
    vel: 0,
    grabbed: false,
    pointer: 0,
    index: 0,
    reduced: false,
  });

  const span = (SPEEDS.length - 1) * ITEM_H;

  const wake = useMotionLoop(() => {
    const strip = stripRef.current;
    if (!strip) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.grabbed) return true;

        if (s.reduced) {
          s.y = clamp(Math.round(s.y / ITEM_H), -SPEEDS.length + 1, 0) * ITEM_H;
          s.vel = 0;
          return false;
        }

        if (Math.abs(s.vel) > WHEEL_DETENT) {
          s.vel *= WHEEL_FRICTION;
          s.y += s.vel;
          if (s.y > 0 || s.y < -span) {
            s.y = clamp(s.y, -span, 0);
            s.vel *= WHEEL_BOUNCE;
          }
          return true;
        }

        const row = clamp(Math.round(s.y / ITEM_H) * ITEM_H, -span, 0);
        s.vel = (s.vel + (row - s.y) * WHEEL_STIFFNESS) * WHEEL_DAMPING;
        s.y += s.vel;

        if (Math.abs(s.vel) < 0.02 && Math.abs(row - s.y) < 0.05) {
          s.y = row;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        strip.style.transform = `translateY(${s.y}px)`;
        const next = clamp(Math.round(-s.y / ITEM_H), 0, SPEEDS.length - 1);
        if (next === s.index) return;
        s.index = next;
        setIndex(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    state.current.reduced = reducedMotion;
    if (reducedMotion) return;
    state.current.vel = -WHEEL_FLICK;
    wake();
  }, [reducedMotion, wake]);

  const release = () => {
    state.current.grabbed = false;
    wake();
  };

  return (
    <div className={styles.wheel}>
      <div
        className={styles.wheelWindow}
        role="listbox"
        tabIndex={0}
        aria-label="Delivery speed"
        aria-activedescendant={`speed-${index}`}
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          if (!step) return;
          event.preventDefault();
          const s = state.current;
          s.y = -clamp(s.index + step, 0, SPEEDS.length - 1) * ITEM_H;
          s.vel = 0;
          wake();
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const s = state.current;
          s.grabbed = true;
          s.pointer = event.clientY;
          s.vel = 0;
          wake();
        }}
        onPointerMove={(event) => {
          const s = state.current;
          if (!s.grabbed) return;
          const delta = event.clientY - s.pointer;
          s.pointer = event.clientY;
          s.y = clamp(s.y + delta, -span - ITEM_H / 2, ITEM_H / 2);
          s.vel = s.vel * 0.5 + delta * 0.5;
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className={styles.wheelLens} aria-hidden />

        <div className={styles.wheelStrip} ref={stripRef}>
          {SPEEDS.map((speed, i) => (
            <span
              key={speed.name}
              id={`speed-${i}`}
              role="option"
              aria-selected={i === index}
              className={styles.wheelItem}
              data-active={i === index}
            >
              {speed.name}
            </span>
          ))}
        </div>
      </div>

      <TextMorph className={styles.wheelArrives}>
        {SPEEDS[index]!.arrives}
      </TextMorph>
    </div>
  );
};

// ── A button you hold ──

export const HOLD_STEPS = [
  { at: 0, label: "Hold to Delete" },
  { at: 0.12, label: "Holding to Delete" },
  { at: 0.62, label: "Deleting" },
  { at: 1, label: "Deleted" },
];

const HOLD_FRAMES = 200;
const HOLD_RELEASE = 0.14; // Progress lost per frame when let go early
const HOLD_REST = 70; // Frames it stays deleted before offering itself again
const HOLD_EVERY = 4600;

const holdLabel = (progress: number) => {
  for (let i = HOLD_STEPS.length - 1; i >= 0; i -= 1) {
    if (progress >= HOLD_STEPS[i]!.at) return HOLD_STEPS[i]!.label;
  }
  return HOLD_STEPS[0]!.label;
};

export const HoldToConfirm = () => {
  const [label, setLabel] = React.useState(HOLD_STEPS[0]!.label);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const fillRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    progress: 0,
    press: 0,
    held: false,
    rest: 0,
    label: HOLD_STEPS[0]!.label,
  });

  const wake = useMotionLoop(() => {
    const button = buttonRef.current;
    const fill = fillRef.current;
    if (!button || !fill) return null;
    const s = state.current;

    return {
      step: () => {
        s.press += ((s.held ? 1 : 0) - s.press) * 0.3;

        if (s.rest > 0) {
          s.rest -= 1;
          if (s.rest === 0) s.progress = 0;
          return true;
        }

        if (s.held) {
          s.progress = Math.min(1, s.progress + 1 / HOLD_FRAMES);
          // Done: it holds the outcome for a beat rather than snapping back.
          if (s.progress === 1) {
            s.held = false;
            s.rest = HOLD_REST;
          }
          return true;
        }

        s.progress = Math.max(0, s.progress - HOLD_RELEASE);
        return s.progress > 0 || s.press > 0.01;
      },
      paint: () => {
        button.style.transform = `scale(${1 - s.press * 0.04})`;
        fill.style.transform = `scaleX(${s.progress})`;

        const next = holdLabel(s.progress);
        if (next === s.label) return;
        s.label = next;
        setLabel(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      state.current.held = true;
      wake();
    }, HOLD_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const press = () => {
    const s = state.current;
    setTaken(true);
    if (s.rest > 0) return;
    s.held = true;
    wake();
  };

  const lift = () => {
    state.current.held = false;
    wake();
  };

  return (
    <button
      type="button"
      className={styles.hold}
      ref={buttonRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        press();
      }}
      onPointerUp={lift}
      onPointerCancel={lift}
      onPointerLeave={lift}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        press();
      }}
      onKeyUp={lift}
      onBlur={lift}
    >
      <span className={styles.holdFill} ref={fillRef} aria-hidden />
      <TextMorph className={styles.holdLabel}>{label}</TextMorph>
    </button>
  );
};

// ── A word that pops ──

// One family, so every step has letters to hand over: Al, Al, Aig, Anig.
export const RATINGS = [
  { word: "Abysmal", tone: "#f2453d" },
  { word: "Awful", tone: "#ff7a2f" },
  { word: "Alright", tone: "#f0b429" },
  { word: "Amazing", tone: "#3b82f6" },
  { word: "Astonishing", tone: "#34c759" },
];

const LAST = RATINGS.length - 1;
const START = 2;

const POP_KICK = 0.9;
const POP_STIFFNESS = 0.24;
const POP_DAMPING = 0.58;
const WORD_GAP = 26; // px from the centre of the face to the word — `.moodWord` offsets by the same
const MOUTH_GLIDE = 0.16; // Share of the way to the new expression the mouth covers per frame
const MOUTH_BEND = 4.4; // viewBox units the middle of the mouth travels either side of flat
const RATE_EVERY = 1800;

const mouthPath = (mood: number) =>
  `M7.8 15.2Q12 ${(15.2 + (mood * 2 - 1) * MOUTH_BEND).toFixed(2)} 16.2 15.2`;

export const RatingSlider = () => {
  const [rating, setRating] = React.useState(START);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const faceRef = React.useRef<HTMLSpanElement>(null);
  const mouthRef = React.useRef<SVGPathElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const wordRef = React.useRef<HTMLSpanElement>(null);
  const dotsRef = React.useRef<(HTMLSpanElement | null)[]>([]);
  const state = React.useRef({
    pop: 0,
    vel: 0,
    mood: START / LAST,
    curve: START / LAST,
    reduced: false,
  });

  const wake = useMotionLoop(() => {
    const face = faceRef.current;
    const mouth = mouthRef.current;
    if (!face || !mouth) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.reduced) {
          s.pop = s.vel = 0;
          s.curve = s.mood;
          return false;
        }
        s.vel = (s.vel - s.pop * POP_STIFFNESS) * POP_DAMPING;
        s.pop += s.vel;
        s.curve += (s.mood - s.curve) * MOUTH_GLIDE;
        if (
          Math.abs(s.vel) < 0.002 &&
          Math.abs(s.pop) < 0.002 &&
          Math.abs(s.mood - s.curve) < 0.001
        ) {
          s.pop = 0;
          s.vel = 0;
          s.curve = s.mood;
          return false;
        }
        return true;
      },
      paint: () => {
        face.style.transform = `translate(-50%, -50%) scale(${1 + s.pop * 0.22}) rotate(${s.pop * 5}deg)`;
        mouth.setAttribute("d", mouthPath(s.curve));
      },
    };
  });

  const choose = React.useCallback(
    (next: number) => {
      const s = state.current;
      // Kicked in the direction of travel, so a slide up and a slide down differ.
      s.vel = POP_KICK * (next > rating ? 0.1 : -0.1);
      s.pop = POP_KICK * 0.25;
      s.mood = next / LAST;
      setRating(next);
      trigger("selection");
      wake();
    },
    [rating, trigger, wake],
  );

  React.useEffect(() => {
    state.current.reduced = reducedMotion;
  }, [reducedMotion]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(
      () => choose((rating + 1) % RATINGS.length),
      RATE_EVERY,
    );
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, rating, choose]);

  const side = rating > LAST / 2 ? "left" : "right";

  // A long word reaches past its neighbour, so the dots it covers yield as it grows.
  React.useEffect(() => {
    const rail = railRef.current;
    const word = wordRef.current;
    if (!rail || !word) return;

    const sync = () => {
      const step = rail.clientWidth / LAST;
      const reach = WORD_GAP + word.offsetWidth;
      dotsRef.current.forEach((dot, i) => {
        const away = (i - rating) * (side === "right" ? 1 : -1);
        dot?.setAttribute(
          "data-covered",
          String(away === 0 || (away > 0 && away * step < reach)),
        );
      });
    };

    const observer = new ResizeObserver(sync);
    observer.observe(word);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [rating, side]);

  const { word, tone } = RATINGS[rating]!;

  return (
    <div className={styles.mood}>
      <input
        className={styles.moodInput}
        type="range"
        min={0}
        max={LAST}
        value={rating}
        aria-label="Rating"
        aria-valuetext={word}
        onChange={(event) => {
          const next = Number(event.target.value);
          setTaken(true);
          if (next !== rating) choose(next);
        }}
      />

      <div className={styles.moodRail} ref={railRef}>
        {RATINGS.map((entry, i) => (
          <span
            key={entry.word}
            className={styles.moodDot}
            style={{ left: `${(i / LAST) * 100}%` }}
            ref={(el) => {
              dotsRef.current[i] = el;
            }}
            aria-hidden
          />
        ))}

        <span
          className={styles.moodPin}
          style={{ left: `${(rating / LAST) * 100}%` }}
          data-side={side}
        >
          <span
            className={styles.moodWord}
            ref={wordRef}
            style={{ color: tone }}
          >
            <TextMorph>{word}</TextMorph>
          </span>

          <span
            className={styles.moodFace}
            ref={faceRef}
            style={{ background: tone }}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="8.8" cy="9.4" r="1.5" />
              <circle cx="15.2" cy="9.4" r="1.5" />
              <path ref={mouthRef} d={mouthPath(rating / LAST)} />
            </svg>
          </span>
        </span>
      </div>
    </div>
  );
};

// ── A tag that trails ──

export const ZONES = [
  "North End",
  "The Harbour",
  "Old Town",
  "Riverside",
  "The Docks",
  "Hillside",
];

const COLS = 3;
const TAG_STIFFNESS = 0.18;
const TAG_DAMPING = 0.66;
const TAG_TILT = 26;
const TAG_SOFT = 34;
const HANG = 8; // px the tag hangs below the point it chases — its string
const EDGE = 6;
const DRIFT = 0.011; // Radians per frame of the path it walks on its own

export const TrailingTag = () => {
  const [zone, setZone] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const fieldRef = React.useRef<HTMLDivElement>(null);
  const tagRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    phase: 0,
    taken: false,
    zone: 0,
    size: { w: 0, h: 0 },
  });

  const wake = useMotionLoop(() => {
    const field = fieldRef.current;
    const tag = tagRef.current;
    if (!field || !tag) return null;

    const s = state.current;
    s.size = { w: field.clientWidth, h: field.clientHeight };
    s.tx = s.x = s.size.w / 2;
    s.ty = s.y = s.size.h / 2;

    return {
      step: () => {
        if (!s.taken) {
          // A slow lissajous, so it visits every zone without repeating a loop.
          s.phase += DRIFT;
          s.tx = s.size.w * (0.5 + 0.36 * Math.sin(s.phase));
          s.ty = s.size.h * (0.5 + 0.3 * Math.sin(s.phase * 1.7));
        }

        s.vx = (s.vx + (s.tx - s.x) * TAG_STIFFNESS) * TAG_DAMPING;
        s.vy = (s.vy + (s.ty - s.y) * TAG_STIFFNESS) * TAG_DAMPING;
        s.x += s.vx;
        s.y += s.vy;

        if (!s.taken) return true;
        return (
          Math.abs(s.vx) > 0.02 ||
          Math.abs(s.vy) > 0.02 ||
          Math.abs(s.tx - s.x) > 0.05 ||
          Math.abs(s.ty - s.y) > 0.05
        );
      },
      paint: () => {
        const tilt = TAG_TILT * Math.tanh(-s.vx / TAG_SOFT);
        // Kept inside the field, the way a tooltip stays on screen at an edge.
        const half = tag.offsetWidth / 2;
        const x = clamp(
          s.x,
          half + EDGE,
          Math.max(half + EDGE, s.size.w - half - EDGE),
        );
        const y = clamp(
          s.y,
          0,
          Math.max(0, s.size.h - tag.offsetHeight - HANG - EDGE),
        );
        tag.style.transform = `translate(${x}px, ${y}px) translateX(-50%) translateY(${HANG}px) rotate(${tilt}deg)`;

        const col = clamp(Math.floor((s.tx / s.size.w) * COLS), 0, COLS - 1);
        const row = clamp(Math.floor((s.ty / s.size.h) * 2), 0, 1);
        const next = row * COLS + col;
        if (next === s.zone) return;
        s.zone = next;
        setZone(next);
      },
    };
  });

  React.useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver(([entry]) => {
      state.current.size = {
        w: entry!.contentRect.width,
        h: entry!.contentRect.height,
      };
      wake();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [wake]);

  React.useEffect(() => {
    state.current.taken = taken || reducedMotion;
    wake();
  }, [taken, reducedMotion, wake]);

  const follow = (event: React.PointerEvent) => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const s = state.current;
    setTaken(true);
    s.taken = true;
    s.tx = clamp(event.clientX - rect.left, 0, rect.width);
    s.ty = clamp(event.clientY - rect.top, 0, rect.height);
    wake();
  };

  return (
    <div
      className={styles.zoneField}
      ref={fieldRef}
      onPointerMove={follow}
      onPointerDown={follow}
    >
      {ZONES.map((name) => (
        <span key={name} className={styles.zone} aria-hidden>
          {name}
        </span>
      ))}

      <div className={styles.tag} ref={tagRef}>
        <TextMorph className={styles.tagLabel}>{ZONES[zone]!}</TextMorph>
      </div>
    </div>
  );
};
