import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clamp, useMotionLoop } from "./use-motion-loop";

// ── Pi, as deep as you drag ──

export const PI =
  "1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679";

const PI_MIN = 2;
const PI_MAX = 60;
const PI_PER_PX = 0.09; // Decimals gained per pixel dragged
const PI_FLOOR = 0.34; // How small a digit may get before the dig stops
const PI_STIFFNESS = 0.18;
const PI_DAMPING = 0.68;
const PI_EVERY = 3200;

export const PiZoom = () => {
  const [depth, setDepth] = React.useState(PI_MIN);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const wellRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const state = React.useRef({
    depth: PI_MIN,
    vel: 0,
    target: PI_MIN,
    grabbed: false,
    from: 0,
    base: PI_MIN,
    charW: 0,
    pad: 0,
    shown: PI_MIN,
    deep: false,
  });

  const wake = useMotionLoop(() => {
    const well = wellRef.current;
    const text = textRef.current;
    if (!well || !text) return null;

    const s = state.current;
    const probe = document.createElement("span");
    const style = getComputedStyle(text);
    Object.assign(probe.style, {
      position: "absolute",
      visibility: "hidden",
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    });
    // Monospaced, so one glyph's width is every glyph's width.
    probe.textContent = "0";
    well.appendChild(probe);
    s.charW = probe.getBoundingClientRect().width;
    probe.remove();

    const well_ = getComputedStyle(well);
    // clientWidth counts the padding in, and the digits are not allowed into it.
    s.pad = parseFloat(well_.paddingLeft) + parseFloat(well_.paddingRight);

    return {
      step: () => {
        if (s.grabbed) return true;

        s.vel = (s.vel + (s.target - s.depth) * PI_STIFFNESS) * PI_DAMPING;
        s.depth += s.vel;

        if (Math.abs(s.vel) < 0.01 && Math.abs(s.target - s.depth) < 0.05) {
          s.depth = s.target;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        s.depth = clamp(s.depth, PI_MIN, PI_MAX);
        // Two glyphs for "3." — the deeper it goes, the smaller each one has to be.
        const scale = clamp(
          (well.clientWidth - s.pad) / ((s.depth + 2) * s.charW),
          PI_FLOOR,
          1,
        );
        text.style.transform = `scale(${scale})`;

        const next = Math.round(s.depth);
        if (next === s.shown) return;
        s.shown = next;
        setDepth(next);
        trigger("selection");
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.deep = !s.deep;
      s.target = s.deep ? PI_MAX : PI_MIN;
      wake();
    }, PI_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    s.target = s.depth;
    wake();
  };

  return (
    <div
      className={styles.pi}
      ref={wellRef}
      role="slider"
      tabIndex={0}
      aria-label="Digits of pi"
      aria-valuemin={PI_MIN}
      aria-valuemax={PI_MAX}
      aria-valuenow={depth}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowDown" || event.key === "ArrowRight"
            ? 4
            : event.key === "ArrowUp" || event.key === "ArrowLeft"
              ? -4
              : 0;
        if (!step) return;
        event.preventDefault();
        const s = state.current;
        setTaken(true);
        s.target = clamp(s.target + step, PI_MIN, PI_MAX);
        wake();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const s = state.current;
        setTaken(true);
        s.grabbed = true;
        s.from = event.clientY;
        s.base = s.depth;
        wake();
      }}
      onPointerMove={(event) => {
        const s = state.current;
        if (!s.grabbed) return;
        s.depth = clamp(
          s.base + (event.clientY - s.from) * PI_PER_PX,
          PI_MIN,
          PI_MAX,
        );
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className={styles.piValue} ref={textRef}>
        <TextMorph>{`3.${PI.slice(0, depth)}`}</TextMorph>
      </span>
    </div>
  );
};

// ── Digits you flick off ──

export const FLICK_START = "84627";

const FLICK_GRAVITY = 1.1;
const FLICK_SPIN = 1.8;
const FLICK_THROW = 4; // px/frame of drag before a let-go counts as a flick
const FLICK_EVERY = 2200;

type Chip = {
  id: number;
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
};

export const FlickDigit = () => {
  const [value, setValue] = React.useState(FLICK_START);
  const [chips, setChips] = React.useState<Chip[]>([]);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const stageRef = React.useRef<HTMLDivElement>(null);
  const chipRefs = React.useRef(new Map<number, HTMLSpanElement>());

  const state = React.useRef({
    chips: [] as Chip[],
    grabbed: false,
    last: 0,
    vx: 0,
    vy: 0,
    seed: 0,
    shown: 0,
    value: FLICK_START,
  });

  const wake = useMotionLoop(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const s = state.current;

    return {
      step: () => {
        if (!s.chips.length) return false;

        for (const chip of s.chips) {
          chip.vy += FLICK_GRAVITY;
          chip.x += chip.vx;
          chip.y += chip.vy;
          chip.angle += chip.spin;
        }
        // Off the bottom is gone; nothing bounces back into the number.
        s.chips = s.chips.filter((chip) => chip.y < stage.clientHeight + 90);
        return true;
      },
      paint: () => {
        for (const chip of s.chips) {
          const node = chipRefs.current.get(chip.id);
          if (!node) continue;
          node.style.transform = `translate(${chip.x}px, ${chip.y}px) rotate(${chip.angle}deg)`;
        }
        if (s.chips.length === s.shown) return;
        s.shown = s.chips.length;
        setChips(s.chips.slice());
      },
    };
  });

  const flick = React.useCallback(
    (vx: number, vy: number) => {
      const s = state.current;
      // Down to one digit it refills, so there is always something to flick.
      const refilled = s.value.length <= 1 ? FLICK_START : s.value;
      s.value = refilled.slice(0, -1);
      s.seed += 1;
      s.chips.push({
        id: s.seed,
        char: refilled[refilled.length - 1]!,
        x: 0,
        y: 0,
        vx,
        vy,
        spin: vx * FLICK_SPIN,
        angle: 0,
      });
      s.shown = s.chips.length;

      setValue(s.value);
      setChips(s.chips.slice());
      trigger("selection");
      wake();
    },
    [trigger, wake],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(
      () => flick(4 + (state.current.seed % 4), -10),
      FLICK_EVERY,
    );
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, flick]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    if (Math.hypot(s.vx, s.vy) >= FLICK_THROW) flick(s.vx, s.vy);
  };

  return (
    <div className={styles.flick} ref={stageRef}>
      <div
        className={styles.flickValue}
        role="button"
        tabIndex={0}
        aria-label={`Flick a digit off — ${value}`}
        onKeyDown={(event) => {
          if (event.key !== "Backspace" && event.key !== "Delete") return;
          event.preventDefault();
          setTaken(true);
          flick(5, -11);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const s = state.current;
          setTaken(true);
          s.grabbed = true;
          s.last = event.clientX;
          s.vx = 0;
          s.vy = 0;
        }}
        onPointerMove={(event) => {
          const s = state.current;
          if (!s.grabbed) return;
          s.vx = s.vx * 0.5 + (event.clientX - s.last) * 0.5;
          s.vy = s.vy * 0.5 - Math.abs(event.movementY) * 0.3;
          s.last = event.clientX;
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <TextMorph>{value}</TextMorph>
      </div>

      {chips.map((chip) => (
        <span
          key={chip.id}
          className={styles.flickChip}
          aria-hidden
          ref={(node) => {
            if (node) chipRefs.current.set(chip.id, node);
            else chipRefs.current.delete(chip.id);
          }}
        >
          {chip.char}
        </span>
      ))}
    </div>
  );
};

// ── A sentence you tear ──

export const SENTENCE = "the quick brown fox jumps over the lazy dog";

const TEAR_PULL = 32; // px of pull before it gives
const TEAR_STIFFNESS = 0.3;
const TEAR_DAMPING = 0.5;
const TEAR_EVERY = 3400;
const TEAR_AT = 4;

export const TearSentence = () => {
  const [lines, setLines] = React.useState([SENTENCE]);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const textRef = React.useRef<HTMLSpanElement>(null);
  const state = React.useRef({
    pull: 0,
    vel: 0,
    grabbed: false,
    from: 0,
    torn: false,
    at: TEAR_AT,
  });

  const wake = useMotionLoop(() => {
    const text = textRef.current;
    if (!text) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.grabbed) return true;
        s.vel = (s.vel - s.pull * TEAR_STIFFNESS) * TEAR_DAMPING;
        s.pull += s.vel;
        if (Math.abs(s.vel) < 0.05 && Math.abs(s.pull) < 0.1) {
          s.pull = 0;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        // It resists, then gives — the give is the tear.
        const give = Math.tanh(s.pull / TEAR_PULL);
        text.style.transform = `translateY(${give * 10}px) rotate(${give * 1.8}deg)`;
      },
    };
  });

  // The word gap nearest the pointer, counted across the whole sentence.
  const gapAt = (event: React.PointerEvent) => {
    const text = textRef.current;
    const words = SENTENCE.split(" ");
    if (!text) return TEAR_AT;
    const rect = text.getBoundingClientRect();
    const share = (event.clientX - rect.left) / Math.max(1, rect.width);
    return clamp(Math.round(share * words.length), 1, words.length - 1);
  };

  const tear = React.useCallback(
    (at: number) => {
      const words = SENTENCE.split(" ");
      setLines([words.slice(0, at).join(" "), words.slice(at).join(" ")]);
      trigger("selection");
    },
    [trigger],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let torn = false;
    const id = window.setInterval(() => {
      torn = !torn;
      setLines(
        torn
          ? [
              SENTENCE.split(" ").slice(0, TEAR_AT).join(" "),
              SENTENCE.split(" ").slice(TEAR_AT).join(" "),
            ]
          : [SENTENCE],
      );
    }, TEAR_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    if (!s.torn) setLines([SENTENCE]);
    s.torn = false;
    wake();
  };

  return (
    <div
      className={styles.tear}
      role="button"
      tabIndex={0}
      aria-label={`Tear the sentence — ${lines.join(", ")}`}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setTaken(true);
        if (lines.length > 1) setLines([SENTENCE]);
        else tear(TEAR_AT);
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const s = state.current;
        setTaken(true);
        s.grabbed = true;
        s.from = event.clientY;
        s.at = gapAt(event);
        s.torn = false;
        wake();
      }}
      onPointerMove={(event) => {
        const s = state.current;
        if (!s.grabbed) return;
        s.pull = event.clientY - s.from;
        if (!s.torn && Math.abs(s.pull) > TEAR_PULL) {
          s.torn = true;
          tear(s.at);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className={styles.tearText} ref={textRef}>
        <TextMorph>{lines.join("\n")}</TextMorph>
      </span>
    </div>
  );
};

// ── A split you drag ──

export const BUDGET = 1000;

const SPLIT_MIN = 0.14;
const SPLIT_STIFFNESS = 0.24;
const SPLIT_DAMPING = 0.56;
const SPLIT_EVERY = 2600;
const SPLITS = [0.64, 0.28, 0.5, 0.83];

export const SplitBar = () => {
  const [split, setSplit] = React.useState(SPLITS[0]!);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const barRef = React.useRef<HTMLDivElement>(null);
  const leftRef = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    split: SPLITS[0]!,
    vel: 0,
    target: SPLITS[0]!,
    grabbed: false,
    shown: SPLITS[0]!,
    step: 0,
  });

  const wake = useMotionLoop(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.grabbed) return true;
        s.vel =
          (s.vel + (s.target - s.split) * SPLIT_STIFFNESS) * SPLIT_DAMPING;
        s.split += s.vel;
        if (Math.abs(s.vel) < 0.0004 && Math.abs(s.target - s.split) < 0.001) {
          s.split = s.target;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        s.split = clamp(s.split, SPLIT_MIN, 1 - SPLIT_MIN);
        left.style.flexGrow = `${s.split}`;
        right.style.flexGrow = `${1 - s.split}`;

        const next = Math.round(s.split * 100) / 100;
        if (next === s.shown) return;
        s.shown = next;
        setSplit(next);
      },
    };
  });

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.step += 1;
      s.target = SPLITS[s.step % SPLITS.length]!;
      wake();
    }, SPLIT_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    s.target = s.split;
    trigger("selection");
    wake();
  };

  const left = Math.round(BUDGET * split);

  return (
    <div className={styles.splitBar} ref={barRef}>
      <div className={styles.splitSide} ref={leftRef}>
        <TextMorph className={styles.splitValue}>
          {`$${left.toLocaleString("en")}`}
        </TextMorph>
      </div>

      <span
        className={styles.splitGrip}
        role="slider"
        tabIndex={0}
        aria-label="Split"
        aria-valuemin={0}
        aria-valuemax={BUDGET}
        aria-valuenow={left}
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowLeft"
              ? -0.04
              : event.key === "ArrowRight"
                ? 0.04
                : 0;
          if (!step) return;
          event.preventDefault();
          const s = state.current;
          setTaken(true);
          s.target = clamp(s.target + step, SPLIT_MIN, 1 - SPLIT_MIN);
          wake();
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setTaken(true);
          state.current.grabbed = true;
          wake();
        }}
        onPointerMove={(event) => {
          const bar = barRef.current;
          const s = state.current;
          if (!bar || !s.grabbed) return;
          const rect = bar.getBoundingClientRect();
          s.split = clamp(
            (event.clientX - rect.left) / rect.width,
            SPLIT_MIN,
            1 - SPLIT_MIN,
          );
        }}
        onPointerUp={release}
        onPointerCancel={release}
      />

      <div
        className={`${styles.splitSide} ${styles.splitRight}`}
        ref={rightRef}
      >
        <TextMorph className={styles.splitValue}>
          {`$${(BUDGET - left).toLocaleString("en")}`}
        </TextMorph>
      </div>
    </div>
  );
};

// ── A word you whip ──

export const WHIP_WORDS = ["SNAPS", "WHIPS", "CRACK", "SWISH", "THWAP"];

const WHIP_LAG = 5; // Frames each letter waits behind the one before it
const WHIP_STIFFNESS = 0.26;
const WHIP_DAMPING = 0.5;
const WHIP_REACH = 90;
const WHIP_EVERY = 3000;

export const WhipWord = () => {
  const [letters, setLetters] = React.useState(() => WHIP_WORDS[0]!.split(""));
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const letterRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const timers = React.useRef<number[]>([]);

  const state = React.useRef({
    pull: 0,
    grabbed: false,
    from: 0,
    word: 0,
    // One spring per letter, each let go a few frames after the one before it.
    cells: WHIP_WORDS[0]!.split("").map(() => ({ x: 0, vel: 0, wait: 0 })),
  });

  const wake = useMotionLoop(() => {
    const s = state.current;

    return {
      step: () => {
        let moving = false;

        s.cells.forEach((cell, i) => {
          // Held back, the tail lags the hand; released, it catches up last.
          const target = s.grabbed
            ? -s.pull * (1 - i / (s.cells.length + 2))
            : 0;

          if (cell.wait > 0) {
            cell.wait -= 1;
            moving = true;
            return;
          }

          cell.vel =
            (cell.vel + (target - cell.x) * WHIP_STIFFNESS) * WHIP_DAMPING;
          cell.x += cell.vel;

          if (Math.abs(cell.vel) < 0.05 && Math.abs(target - cell.x) < 0.1) {
            cell.x = target;
            cell.vel = 0;
          } else {
            moving = true;
          }
        });

        return moving || s.grabbed;
      },
      paint: () => {
        s.cells.forEach((cell, i) => {
          const node = letterRefs.current[i];
          if (!node) return;
          const lean = clamp(cell.vel * 1.6, -24, 24);
          node.style.transform = `translateX(${cell.x}px) rotate(${lean}deg)`;
        });
      },
    };
  });

  // Each letter lands a beat after the one before it, so the change travels too.
  const crack = React.useCallback(() => {
    const s = state.current;
    s.word = (s.word + 1) % WHIP_WORDS.length;
    s.cells.forEach((cell, i) => {
      cell.wait = i * WHIP_LAG;
    });

    timers.current.forEach(window.clearTimeout);
    timers.current = WHIP_WORDS[s.word]!.split("").map((char, i) =>
      window.setTimeout(
        () =>
          setLetters((current) => {
            const next = current.slice();
            next[i] = char;
            return next;
          }),
        i * WHIP_LAG * 16,
      ),
    );

    trigger("selection");
    wake();
  }, [trigger, wake]);

  React.useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.grabbed = true;
      s.pull = WHIP_REACH;
      wake();
      window.setTimeout(() => {
        s.grabbed = false;
        s.pull = 0;
        crack();
      }, 420);
    }, WHIP_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, crack, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    const cracked = s.pull > WHIP_REACH * 0.35;
    s.pull = 0;
    if (cracked) crack();
    else wake();
  };

  return (
    <div
      className={styles.whip}
      role="button"
      tabIndex={0}
      aria-label={`Whip the word — ${letters.join("")}`}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setTaken(true);
        crack();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const s = state.current;
        setTaken(true);
        s.grabbed = true;
        s.from = event.clientX;
        s.pull = 0;
        wake();
      }}
      onPointerMove={(event) => {
        const s = state.current;
        if (!s.grabbed) return;
        s.pull = clamp(s.from - event.clientX, 0, WHIP_REACH);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {letters.map((char, i) => (
        <span
          key={i}
          className={styles.whipLetter}
          ref={(node) => {
            letterRefs.current[i] = node;
          }}
        >
          <TextMorph>{char}</TextMorph>
        </span>
      ))}
    </div>
  );
};
