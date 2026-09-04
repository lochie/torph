import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { ResizeFrame } from "@/components/resize-frame";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { measureForms } from "./measure";
import { clamp, useMotionLoop } from "./use-motion-loop";

// The longest form that still fits without being squashed past `floor`.
const formFor = (widths: number[], width: number, floor: number) => {
  const i = widths.findIndex((natural) => natural * floor <= width);
  return i < 0 ? widths.length - 1 : i;
};

// ── A figure you squash ──

export const FIGURES = ["1,248,392", "1,248K", "1.2M", "1M"];

const SQUISH_FLOOR = 0.84; // How far a form squashes before it gives
const SQUISH_CEILING = 1.15;
const SQUISH_STIFFNESS = 0.2;
const SQUISH_DAMPING = 0.62;
const SQUISH_EVERY = 3400;

export const SquishyNumber = () => {
  const [form, setForm] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const boxRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    width: 0,
    vel: 0,
    target: 0,
    grabbed: false,
    from: 0,
    widths: [] as number[],
    form: 0,
    wide: true,
  });

  const wake = useMotionLoop(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return null;

    const s = state.current;
    s.widths = measureForms(text, FIGURES);
    s.width = s.target = s.widths[0]!;

    const floor = () => s.widths[s.widths.length - 1]! * SQUISH_FLOOR;
    const ceiling = () => s.widths[0]! * SQUISH_CEILING;

    return {
      step: () => {
        if (s.grabbed) return true;

        s.vel =
          (s.vel + (s.target - s.width) * SQUISH_STIFFNESS) * SQUISH_DAMPING;
        s.width += s.vel;

        if (Math.abs(s.vel) < 0.05 && Math.abs(s.target - s.width) < 0.2) {
          // A figure held squashed reads as broken type, so rest is its natural width.
          const rest = s.widths[s.form]!;
          if (Math.abs(rest - s.width) > 0.2) {
            s.target = rest;
            return true;
          }
          s.width = s.target;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        s.width = clamp(s.width, floor(), ceiling());
        const next = formFor(s.widths, s.width, SQUISH_FLOOR);
        const k = clamp(
          s.width / s.widths[next]!,
          SQUISH_FLOOR,
          SQUISH_CEILING,
        );

        box.style.width = `${s.width}px`;
        // Squash one way, swell the other — the volume has to go somewhere.
        text.style.transform = `scaleX(${k}) scaleY(${1 + (1 - k) * 0.35})`;

        if (next === s.form) return;
        s.form = next;
        setForm(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.wide = !s.wide;
      s.target = s.wide
        ? s.widths[0]! * SQUISH_CEILING
        : s.widths[s.widths.length - 1]! * SQUISH_FLOOR;
      wake();
    }, SQUISH_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    s.target = s.width;
    wake();
  };

  return (
    <div className={styles.squish}>
      <div className={styles.squishBox} ref={boxRef}>
        <span className={styles.squishText} ref={textRef}>
          <TextMorph>{FIGURES[form]!}</TextMorph>
        </span>
      </div>

      <span
        className={styles.squishHandle}
        role="slider"
        tabIndex={0}
        aria-label="Width"
        aria-valuemin={0}
        aria-valuemax={FIGURES.length - 1}
        aria-valuenow={FIGURES.length - 1 - form}
        aria-valuetext={FIGURES[form]!}
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowLeft"
              ? -24
              : event.key === "ArrowRight"
                ? 24
                : 0;
          if (!step) return;
          event.preventDefault();
          const s = state.current;
          setTaken(true);
          s.target = s.width + step;
          wake();
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const s = state.current;
          setTaken(true);
          s.grabbed = true;
          s.from = event.clientX - s.width;
          wake();
        }}
        onPointerMove={(event) => {
          const s = state.current;
          if (!s.grabbed) return;
          s.width = event.clientX - s.from;
        }}
        onPointerUp={release}
        onPointerCancel={release}
      />
    </div>
  );
};

// ── A sentence you squeeze ──

export const PHRASES = [
  "3 hours 24 minutes ago",
  "3 hr 24 min ago",
  "3h 24m ago",
  "3h ago",
  "now",
];

const SQUEEZE_EVERY = 3000;
const SQUEEZE_STIFFNESS = 0.22;
const SQUEEZE_DAMPING = 0.66;

export const SqueezeToAbbreviate = () => {
  const [form, setForm] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const cellRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    width: 0,
    vel: 0,
    target: 0,
    grabbed: false,
    from: 0,
    widths: [] as number[],
    form: 0,
    wide: true,
  });

  const wake = useMotionLoop(() => {
    const cell = cellRef.current;
    const text = textRef.current;
    if (!cell || !text) return null;

    const s = state.current;
    s.widths = measureForms(text, PHRASES);
    s.width = s.target = s.widths[0]! + 16;

    const floor = () => s.widths[s.widths.length - 1]!;
    const ceiling = () => s.widths[0]! + 24;

    return {
      step: () => {
        if (s.grabbed) return true;

        s.vel =
          (s.vel + (s.target - s.width) * SQUEEZE_STIFFNESS) * SQUEEZE_DAMPING;
        s.width += s.vel;

        if (Math.abs(s.vel) < 0.05 && Math.abs(s.target - s.width) < 0.2) {
          s.width = s.target;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        s.width = clamp(s.width, floor(), ceiling());
        cell.style.width = `${s.width}px`;

        // No squashing here: prose that distorts reads as broken, not as rubber.
        const next = formFor(s.widths, s.width, 1);
        if (next === s.form) return;
        s.form = next;
        setForm(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.wide = !s.wide;
      s.target = s.wide ? s.widths[0]! + 24 : s.widths[s.widths.length - 1]!;
      wake();
    }, SQUEEZE_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    s.target = s.width;
    wake();
  };

  return (
    <ResizeFrame
      className={styles.squeezeFrame}
      cellRef={cellRef}
      label="Column width"
      valueMin={0}
      valueMax={PHRASES.length - 1}
      valueNow={PHRASES.length - 1 - form}
      valueText={PHRASES[form]!}
      getWidth={() => state.current.width}
      onGrab={() => {
        setTaken(true);
        state.current.grabbed = true;
        wake();
      }}
      onResize={(width) => {
        state.current.width = width;
      }}
      onRelease={release}
      onStep={(delta) => {
        const s = state.current;
        setTaken(true);
        s.target = s.width + delta;
        wake();
      }}
    >
      <span className={styles.squeezeText} ref={textRef}>
        <TextMorph>{PHRASES[form]!}</TextMorph>
      </span>
    </ResizeFrame>
  );
};

// ── A word you pull ──

// One "a" at a time: even bands mean an even stretch before each click, and a
// long rail turns into a lot of them.
export const TAFFY = Array.from(
  { length: 16 },
  (_, i) => `ok${"a".repeat(i + 1)}y`,
);

const TAFFY_THIN = 0.42; // How much height it gives up per unit of width gained
const TAFFY_MIN_Y = 0.64;
const TAFFY_RECOIL = 0.55; // Share of the released stretch that comes back as a snap
const TAFFY_RECOIL_MAX = 0.2;
const TAFFY_STRETCH_MAX = 1.6;
const RECOIL_STIFFNESS = 0.32;
const RECOIL_DAMPING = 0.54;
const TAFFY_STIFFNESS = 0.26;
const TAFFY_DAMPING = 0.52;
const TAFFY_EVERY = 3200;

export const TaffyWord = () => {
  const [form, setForm] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const railRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    pull: 0,
    vel: 0,
    target: 0,
    grabbed: false,
    from: 0,
    widths: [] as number[],
    form: 0,
    max: 0,
    recoil: 0,
    recoilVel: 0,
  });

  const wake = useMotionLoop(() => {
    const rail = railRef.current;
    const text = textRef.current;
    if (!rail || !text) return null;

    const s = state.current;
    s.widths = measureForms(text, TAFFY);
    s.max = Math.max(0, rail.clientWidth - s.widths[0]!);

    return {
      step: () => {
        s.recoilVel =
          (s.recoilVel - s.recoil * RECOIL_STIFFNESS) * RECOIL_DAMPING;
        s.recoil += s.recoilVel;
        const snapping =
          Math.abs(s.recoilVel) > 0.0005 || Math.abs(s.recoil) > 0.001;
        if (!snapping) {
          s.recoil = 0;
          s.recoilVel = 0;
        }

        if (s.grabbed) return true;

        s.vel = (s.vel + (s.target - s.pull) * TAFFY_STIFFNESS) * TAFFY_DAMPING;
        s.pull += s.vel;

        if (Math.abs(s.vel) < 0.05 && Math.abs(s.target - s.pull) < 0.2) {
          s.pull = s.target;
          s.vel = 0;
          return snapping;
        }
        return true;
      },
      paint: () => {
        const span = s.widths[0]! + clamp(s.pull, 0, s.max);

        // The longest form that still fits: past its natural width the word gives
        // and grows, which is what drops the stretch back down.
        let next = 0;
        for (let i = TAFFY.length - 1; i >= 0; i -= 1) {
          if (s.widths[i]! <= span) {
            next = i;
            break;
          }
        }

        const stretch = clamp(
          (span / s.widths[next]!) * (1 + s.recoil),
          0.7,
          TAFFY_STRETCH_MAX,
        );
        // Taffy thins as it lengthens.
        const thin = Math.max(TAFFY_MIN_Y, 1 - (stretch - 1) * TAFFY_THIN);
        text.style.transform = `scaleX(${stretch}) scaleY(${thin})`;

        if (next === s.form) return;
        // The tension the extra letter just released, handed back as a snap.
        const released = span / s.widths[s.form]! - span / s.widths[next]!;
        s.recoil = clamp(
          -released * TAFFY_RECOIL,
          -TAFFY_RECOIL_MAX,
          TAFFY_RECOIL_MAX,
        );
        s.recoilVel = 0;
        s.form = next;
        setForm(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(([entry]) => {
      const s = state.current;
      s.max = Math.max(0, entry!.contentRect.width - (s.widths[0] ?? 0));
      wake();
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [wake]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let out = false;
    const id = window.setInterval(() => {
      out = !out;
      state.current.target = out ? state.current.max : 0;
      wake();
    }, TAFFY_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    s.target = 0;
    wake();
  };

  return (
    <div
      className={styles.taffy}
      ref={railRef}
      role="button"
      tabIndex={0}
      aria-label={`Pull the word — ${TAFFY[form]!}`}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowRight" ? 44 : event.key === "ArrowLeft" ? -44 : 0;
        if (!step) return;
        event.preventDefault();
        const s = state.current;
        setTaken(true);
        s.target = clamp(s.target + step, 0, s.max);
        wake();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const s = state.current;
        setTaken(true);
        s.grabbed = true;
        s.from = event.clientX - s.pull;
        wake();
      }}
      onPointerMove={(event) => {
        const s = state.current;
        if (!s.grabbed) return;
        s.pull = clamp(event.clientX - s.from, 0, s.max);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className={styles.taffyWord} ref={textRef}>
        <TextMorph>{TAFFY[form]!}</TextMorph>
      </span>
    </div>
  );
};

// ── Digits you drag ──

export const PLACES = [1000, 100, 10, 1];

const SCRUB_MAX = 9999;
const SCRUB_STEP = 11; // px of drag per unit of the grabbed place
const SCRUB_NUDGES = [1, 2, 0, 3, 1, 2];
const SCRUB_EVERY = 1500;

export const DragDigit = () => {
  const [value, setValue] = React.useState(4271);
  const [place, setPlace] = React.useState(-1);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const lensRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({ place: -1, from: 0, base: 0, x: 0, vel: 0 });

  const wake = useMotionLoop(() => {
    const lens = lensRef.current;
    if (!lens) return null;
    const s = state.current;

    return {
      step: () => s.place >= 0,
      paint: () => {
        lens.style.opacity = s.place >= 0 ? "1" : "0";
        if (s.place >= 0)
          lens.style.transform = `translateX(${s.place * 100}%)`;
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let nudge = 0;
    const id = window.setInterval(() => {
      const at = SCRUB_NUDGES[nudge % SCRUB_NUDGES.length]!;
      nudge += 1;
      setValue((v) =>
        clamp(v + PLACES[at]! * (nudge % 2 ? 1 : -1), 0, SCRUB_MAX),
      );
    }, SCRUB_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const release = () => {
    const s = state.current;
    if (s.place < 0) return;
    s.place = -1;
    setPlace(-1);
    wake();
  };

  return (
    <div className={styles.scrub}>
      <span className={styles.scrubLens} ref={lensRef} aria-hidden />

      <TextMorph className={styles.scrubValue}>
        {String(value).padStart(PLACES.length, "0")}
      </TextMorph>

      {/* Tabular figures, so every place is exactly one column wide. */}
      <div className={styles.scrubColumns}>
        {PLACES.map((step, i) => (
          <span
            key={step}
            className={styles.scrubColumn}
            role="slider"
            tabIndex={0}
            aria-label={`${step}s`}
            aria-valuemin={0}
            aria-valuemax={SCRUB_MAX}
            aria-valuenow={value}
            data-active={place === i}
            onKeyDown={(event) => {
              const dir =
                event.key === "ArrowUp"
                  ? 1
                  : event.key === "ArrowDown"
                    ? -1
                    : 0;
              if (!dir) return;
              event.preventDefault();
              setTaken(true);
              setValue((v) => clamp(v + step * dir, 0, SCRUB_MAX));
              trigger("selection");
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const s = state.current;
              setTaken(true);
              s.place = i;
              s.from = event.clientY;
              s.base = value;
              setPlace(i);
              wake();
            }}
            onPointerMove={(event) => {
              const s = state.current;
              if (s.place !== i) return;
              const units = Math.round((s.from - event.clientY) / SCRUB_STEP);
              const next = clamp(s.base + units * step, 0, SCRUB_MAX);
              setValue((current) => {
                if (next !== current) trigger("selection");
                return next;
              });
            }}
            onPointerUp={release}
            onPointerCancel={release}
          />
        ))}
      </div>
    </div>
  );
};

// ── Letters you rearrange ──

export const BEADS = ["L", "I", "S", "T", "E", "N"];

const ANAGRAMS = new Set([
  "LISTEN",
  "SILENT",
  "ENLIST",
  "TINSEL",
  "INLETS",
  "ELINTS",
]);
const BEAD_SHUFFLES = [
  [0, 3],
  [4, 0],
  [5, 2],
  [2, 5],
  [1, 4],
];
const BEAD_EVERY = 2400;

const moveBead = (letters: string[], from: number, to: number) => {
  const next = letters.slice();
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
};

export const LetterBeads = () => {
  const [letters, setLetters] = React.useState(BEADS);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const wordRef = React.useRef<HTMLSpanElement>(null);
  const lensRef = React.useRef<HTMLSpanElement>(null);
  const state = React.useRef({ held: -1, x: 0, letters: BEADS });

  // Letters sit on every other monospace cell; the gaps are the spaces between.
  const cellsFor = (width: number) => width / (BEADS.length * 2 - 1);

  const wake = useMotionLoop(() => {
    const word = wordRef.current;
    const lens = lensRef.current;
    if (!word || !lens) return null;
    const s = state.current;

    return {
      step: () => s.held >= 0,
      paint: () => {
        lens.style.opacity = s.held >= 0 ? "1" : "0";
        if (s.held >= 0) lens.style.transform = `translateX(${s.x}px)`;
      },
    };
  });

  React.useEffect(() => {
    state.current.letters = letters;
  }, [letters]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let shuffle = 0;
    const id = window.setInterval(() => {
      const [from, to] = BEAD_SHUFFLES[shuffle % BEAD_SHUFFLES.length]!;
      shuffle += 1;
      setLetters((current) => moveBead(current, from!, to!));
    }, BEAD_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const at = (event: React.PointerEvent) => {
    const word = wordRef.current;
    if (!word) return { slot: 0, x: 0 };
    const rect = word.getBoundingClientRect();
    const cell = cellsFor(rect.width);
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    return { slot: clamp(Math.round(x / (cell * 2)), 0, BEADS.length - 1), x };
  };

  const release = () => {
    const s = state.current;
    if (s.held < 0) return;
    s.held = -1;
    wake();
  };

  const word = letters.join("");
  const known = ANAGRAMS.has(word);

  return (
    <div
      className={styles.beads}
      role="button"
      tabIndex={0}
      aria-label={`Rearrange the letters — currently ${word}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const { slot, x } = at(event);
        const s = state.current;
        setTaken(true);
        s.held = slot;
        s.x = x;
        wake();
      }}
      onPointerMove={(event) => {
        const s = state.current;
        if (s.held < 0) return;
        const { slot, x } = at(event);
        s.x = x;
        if (slot === s.held) return;
        // Captured: the updater runs after `held` has already moved on.
        const from = s.held;
        s.held = slot;
        setLetters((current) => moveBead(current, from, slot));
        trigger("selection");
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className={styles.beadsLens} ref={lensRef} aria-hidden />

      <span className={styles.beadsWord} ref={wordRef}>
        {/* Spaced, so every letter is its own segment and keeps its own identity. */}
        <TextMorph style={{ color: known ? "var(--primary)" : "#ffffff" }}>
          {letters.join(" ")}
        </TextMorph>
      </span>
    </div>
  );
};
