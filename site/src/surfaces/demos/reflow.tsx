import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { measureForms } from "./measure";
import { clamp, useMotionLoop } from "./use-motion-loop";

// ── A break you drag ──

export const BREAK_WORDS =
  "one bead sits between two words and every drag moves it".split(" ");

const BREAK_MIN = 1;
const BREAK_MAX = BREAK_WORDS.length - 1;
const BEAD_STIFFNESS = 0.24;
const BEAD_DAMPING = 0.58;
const CLUNK = 0.34; // How hard the bead squashes on the frame a word changes line
const BREAK_EVERY = 2200;
const BREAK_STOPS = [4, 8, 2, 6, 10];

export const DragBreak = () => {
  const [at, setAt] = React.useState(BREAK_STOPS[0]!);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const blockRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const beadRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    at: BREAK_STOPS[0]!,
    x: 0,
    vel: 0,
    clunk: 0,
    clunkVel: 0,
    grabbed: false,
    // Prefix widths: the bead belongs at the end of whatever the first line is.
    prefixes: [] as number[],
    stop: 0,
  });

  const wake = useMotionLoop(() => {
    const text = textRef.current;
    const bead = beadRef.current;
    if (!text || !bead) return null;

    const s = state.current;
    s.prefixes = measureForms(
      text,
      BREAK_WORDS.map((_, i) => BREAK_WORDS.slice(0, i + 1).join(" ")),
    );
    s.x = s.prefixes[s.at - 1]!;

    return {
      step: () => {
        const target = s.prefixes[s.at - 1] ?? 0;
        s.vel = (s.vel + (target - s.x) * BEAD_STIFFNESS) * BEAD_DAMPING;
        s.x += s.vel;

        s.clunkVel = (s.clunkVel - s.clunk * 0.3) * 0.55;
        s.clunk += s.clunkVel;

        const still =
          Math.abs(s.vel) < 0.05 &&
          Math.abs(target - s.x) < 0.2 &&
          Math.abs(s.clunk) < 0.002;
        if (still) {
          s.x = target;
          s.vel = 0;
          s.clunk = 0;
          s.clunkVel = 0;
        }
        return !still || s.grabbed;
      },
      paint: () => {
        const squash = 1 + s.clunk;
        bead.style.transform = `translateX(${s.x}px) translateX(-50%) scale(${2 - squash}, ${squash})`;
      },
    };
  });

  // The gap nearest the pointer, by how wide the first line would be there.
  const gapAt = (event: React.PointerEvent) => {
    const text = textRef.current;
    const s = state.current;
    if (!text || !s.prefixes.length) return s.at;
    const x = event.clientX - text.getBoundingClientRect().left;
    let best = BREAK_MIN;
    for (let i = BREAK_MIN; i <= BREAK_MAX; i += 1) {
      if (
        Math.abs(s.prefixes[i - 1]! - x) < Math.abs(s.prefixes[best - 1]! - x)
      ) {
        best = i;
      }
    }
    return best;
  };

  const moveTo = React.useCallback(
    (next: number) => {
      const s = state.current;
      if (next === s.at) return;
      // A word just changed line — the bead takes the knock.
      s.clunk = -CLUNK;
      s.clunkVel = 0;
      s.at = next;
      setAt(next);
      trigger("selection");
      wake();
    },
    [trigger, wake],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.stop += 1;
      moveTo(BREAK_STOPS[s.stop % BREAK_STOPS.length]!);
    }, BREAK_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, moveTo]);

  const release = () => {
    state.current.grabbed = false;
    wake();
  };

  return (
    <div
      className={styles.breakBlock}
      ref={blockRef}
      role="slider"
      tabIndex={0}
      aria-label="Line break"
      aria-valuemin={BREAK_MIN}
      aria-valuemax={BREAK_MAX}
      aria-valuenow={at}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (!step) return;
        event.preventDefault();
        setTaken(true);
        moveTo(clamp(at + step, BREAK_MIN, BREAK_MAX));
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setTaken(true);
        state.current.grabbed = true;
        moveTo(gapAt(event));
        wake();
      }}
      onPointerMove={(event) => {
        if (!state.current.grabbed) return;
        moveTo(gapAt(event));
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className={styles.breakText} ref={textRef}>
        <TextMorph>
          {`${BREAK_WORDS.slice(0, at).join(" ")}\n${BREAK_WORDS.slice(at).join(" ")}`}
        </TextMorph>
      </span>

      <span className={styles.breakBead} ref={beadRef} aria-hidden />
    </div>
  );
};

// ── A block you pump ──

export const PUMP_WORDS =
  "hold it down and the block fills out until two lines become one".split(" ");

const PUMP_MIN = 96;
const PUMP_MAX = 340;
const PUMP_RATE = 4.4; // px of width per frame while held
const PUMP_LEAK = 1.1; // px it gives back per frame once let go
const PUMP_STIFFNESS = 0.22;
const PUMP_DAMPING = 0.52;
const PUMP_WOBBLE = 0.13;
const PUMP_EVERY = 4200;
const PUMP_HOLD = 3200;

export const PumpBlock = () => {
  const [lines, setLines] = React.useState([PUMP_WORDS.join(" ")]);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const blobRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    width: PUMP_MIN,
    shown: PUMP_MIN,
    vel: 0,
    held: false,
    wobble: 0,
    wobbleVel: 0,
    words: [] as number[],
    space: 0,
    count: 1,
    shownLines: "",
  });

  // Greedy: the first word that will not fit starts the next line.
  const wrap = React.useCallback((width: number) => {
    const s = state.current;
    const out: string[] = [];
    let line: string[] = [];
    let run = 0;

    for (let i = 0; i < PUMP_WORDS.length; i += 1) {
      const add = (line.length ? s.space : 0) + s.words[i]!;
      if (line.length && run + add > width) {
        out.push(line.join(" "));
        line = [PUMP_WORDS[i]!];
        run = s.words[i]!;
        continue;
      }
      line.push(PUMP_WORDS[i]!);
      run += add;
    }
    out.push(line.join(" "));
    return out;
  }, []);

  const wake = useMotionLoop(() => {
    const blob = blobRef.current;
    const text = textRef.current;
    if (!blob || !text) return null;

    const s = state.current;
    s.words = measureForms(text, PUMP_WORDS);
    s.space = measureForms(text, [" "])[0]!;

    return {
      step: () => {
        const target = s.held
          ? Math.min(PUMP_MAX, s.width + PUMP_RATE)
          : Math.max(PUMP_MIN, s.width - PUMP_LEAK);

        s.vel = (s.vel + (target - s.width) * PUMP_STIFFNESS) * PUMP_DAMPING;
        s.width = clamp(s.width + s.vel, PUMP_MIN, PUMP_MAX);

        s.wobbleVel = (s.wobbleVel - s.wobble * 0.26) * 0.6;
        s.wobble += s.wobbleVel;

        const still =
          !s.held &&
          s.width === PUMP_MIN &&
          Math.abs(s.vel) < 0.05 &&
          Math.abs(s.wobble) < 0.002;
        if (still) {
          s.vel = 0;
          s.wobble = 0;
          s.wobbleVel = 0;
        }
        return !still;
      },
      paint: () => {
        blob.style.width = `${s.width}px`;
        const swell = 1 + s.wobble;
        blob.style.transform = `scale(${swell}, ${2 - swell})`;

        const next = wrap(s.width);
        if (next.length === s.count && next.join("|") === s.shownLines) return;
        // Only a change in the number of lines is worth a wobble.
        if (next.length !== s.count) {
          s.wobble = PUMP_WOBBLE;
          s.wobbleVel = 0;
          trigger("selection");
        }
        s.count = next.length;
        s.shownLines = next.join("|");
        setLines(next);
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      state.current.held = true;
      wake();
      window.setTimeout(() => {
        state.current.held = false;
      }, PUMP_HOLD);
    }, PUMP_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const press = () => {
    setTaken(true);
    state.current.held = true;
    wake();
  };

  const lift = () => {
    state.current.held = false;
    wake();
  };

  return (
    <div
      className={styles.pump}
      ref={blobRef}
      role="button"
      tabIndex={0}
      aria-label={`Hold to widen — ${lines.length} lines`}
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
      <span className={styles.pumpText} ref={textRef}>
        <TextMorph>{lines.join("\n")}</TextMorph>
      </span>
    </div>
  );
};
