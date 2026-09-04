import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clamp, useMotionLoop } from "./use-motion-loop";

// ── A lever you pull ──

export const REEL_FACES = ["7", "3", "9", "2", "5", "8", "4", "6"];

const SPIN_VEL = 0.3; // Faces per frame at full speed
const SPIN_DECAY = 0.93;
const SPIN_FRAMES = 34; // Full-speed frames for the first reel
const SPIN_STAGGER = 27; // What each reel to the right adds — the whole trick
const LEVER_TRAVEL = 52;
const LEVER_THRESHOLD = 0.5;
const LEVER_STIFFNESS = 0.3;
const LEVER_DAMPING = 0.55;
const PULL_EVERY = 4200;

const face = (pos: number) => REEL_FACES[Math.floor(pos) % REEL_FACES.length]!;

const verdict = (faces: string[]) => {
  const [a, b, c] = faces;
  if (a === b && b === c) return "Jackpot";
  return a === b || b === c || a === c ? "Two of a kind" : "Nothing";
};

export const SlotLever = () => {
  const [faces, setFaces] = React.useState(["7", "3", "9"]);
  const [settled, setSettled] = React.useState(true);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const knobRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    reels: [0, 1, 2].map((i) => ({ pos: i * 2, vel: 0, frames: 0 })),
    lever: { y: 0, vel: 0, grabbed: false, from: 0 },
    faces: ["7", "3", "9"],
    spinning: false,
  });

  const wake = useMotionLoop(() => {
    const knob = knobRef.current;
    if (!knob) return null;
    const s = state.current;

    return {
      step: () => {
        const lever = s.lever;
        if (!lever.grabbed) {
          lever.vel = (lever.vel - lever.y * LEVER_STIFFNESS) * LEVER_DAMPING;
          lever.y += lever.vel;
          if (Math.abs(lever.vel) < 0.05 && Math.abs(lever.y) < 0.1) {
            lever.y = 0;
            lever.vel = 0;
          }
        }

        let spinning = false;
        for (const reel of s.reels) {
          if (reel.frames > 0) {
            reel.frames -= 1;
            reel.pos += reel.vel;
            spinning = true;
          } else if (reel.vel > 0.02) {
            reel.vel *= SPIN_DECAY;
            reel.pos += reel.vel;
            spinning = true;
          } else if (reel.vel > 0) {
            reel.vel = 0;
            // Forward, so the reel's last move is a tick on rather than a snap back.
            reel.pos = Math.ceil(reel.pos);
          }
        }
        s.spinning = spinning;

        return spinning || lever.grabbed || lever.y !== 0;
      },
      paint: () => {
        knob.style.transform = `translateY(${s.lever.y}px)`;

        const next = s.reels.map((reel) => face(reel.pos));
        if (next.some((value, i) => value !== s.faces[i])) {
          s.faces = next;
          setFaces(next);
        }
        setSettled(!s.spinning);
      },
    };
  });

  const pull = React.useCallback(() => {
    const s = state.current;
    s.reels.forEach((reel, i) => {
      reel.vel = SPIN_VEL;
      reel.frames = SPIN_FRAMES + i * SPIN_STAGGER;
    });
    s.lever.y = LEVER_TRAVEL;
    s.lever.vel = 0;
    trigger("selection");
    wake();
  }, [trigger, wake]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(pull, PULL_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, pull]);

  const release = () => {
    const s = state.current;
    if (!s.lever.grabbed) return;
    s.lever.grabbed = false;
    setTaken(true);
    if (s.lever.y > LEVER_TRAVEL * LEVER_THRESHOLD) pull();
    else wake();
  };

  return (
    <div className={styles.slot}>
      <div className={styles.slotHead}>
        <div className={styles.slotBody}>
          {faces.map((value, i) => (
            <div key={i} className={styles.reel}>
              <TextMorph className={styles.reelFace}>{value}</TextMorph>
            </div>
          ))}
        </div>

        <div
          className={styles.lever}
          role="button"
          tabIndex={0}
          aria-label="Pull the lever"
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setTaken(true);
            pull();
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const s = state.current;
            s.lever.grabbed = true;
            s.lever.from = event.clientY - s.lever.y;
            wake();
          }}
          onPointerMove={(event) => {
            const s = state.current;
            if (!s.lever.grabbed) return;
            s.lever.y = clamp(event.clientY - s.lever.from, 0, LEVER_TRAVEL);
          }}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <span className={styles.leverStem} aria-hidden />
          <span className={styles.leverKnob} ref={knobRef} aria-hidden />
        </div>
      </div>

      <TextMorph className={styles.slotVerdict}>
        {settled ? verdict(faces) : "…"}
      </TextMorph>
    </div>
  );
};

// ── A tank that sloshes ──

export const LEVELS = [0.72, 0.52, 0.95, 0.46];

const TANK_W = 100; // viewBox units; the SVG stretches to the tank
const TANK_H = 60;
const SLOSH_STIFFNESS = 0.09;
const SLOSH_DAMPING = 0.82;
const WAVE_STIFFNESS = 0.16;
const WAVE_DAMPING = 0.9;
const WAVE_DRIVE = 0.55;
const WAVE_SPEED = 0.24;
const POINTS = 24;
const FILL_EVERY = 2600;

export const SloshGauge = () => {
  const [level, setLevel] = React.useState(LEVELS[0]!);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const tankRef = React.useRef<HTMLDivElement>(null);
  const pathRef = React.useRef<SVGPathElement>(null);
  const overRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    level: LEVELS[0]!,
    vel: 0,
    wave: 0,
    waveVel: 0,
    phase: 0,
    target: LEVELS[0]!,
    reduced: false,
  });

  const wake = useMotionLoop(() => {
    const path = pathRef.current;
    const over = overRef.current;
    if (!path || !over) return null;
    const s = state.current;

    return {
      step: () => {
        if (s.reduced) {
          s.level = s.target;
          s.vel = s.wave = s.waveVel = 0;
          return false;
        }

        s.vel =
          (s.vel + (s.target - s.level) * SLOSH_STIFFNESS) * SLOSH_DAMPING;
        s.level += s.vel;

        // The surface is driven by the body's own movement, then rings on its own.
        s.waveVel =
          (s.waveVel - s.wave * WAVE_STIFFNESS) * WAVE_DAMPING -
          s.vel * WAVE_DRIVE;
        s.wave += s.waveVel;
        s.phase += WAVE_SPEED;

        return (
          Math.abs(s.vel) > 0.0004 ||
          Math.abs(s.target - s.level) > 0.001 ||
          Math.abs(s.wave) > 0.02 ||
          Math.abs(s.waveVel) > 0.01
        );
      },
      paint: () => {
        const base = TANK_H - s.level * TANK_H;
        const amp = clamp(s.wave * 22, -7, 7);

        let d = "";
        const surface: string[] = [];
        for (let i = 0; i <= POINTS; i += 1) {
          const t = i / POINTS;
          const x = t * TANK_W;
          const y =
            base +
            amp * Math.sin(s.phase + t * Math.PI * 2.2) +
            amp * 0.5 * (t - 0.5);
          d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
          surface.push(
            `${(t * 100).toFixed(2)}% ${((y / TANK_H) * 100).toFixed(2)}%`,
          );
        }
        path.setAttribute("d", `${d}L${TANK_W} ${TANK_H}L0 ${TANK_H}Z`);
        // The same surface in the value's own box, so the digits under it read dark.
        over.style.clipPath = `polygon(${surface.join(",")},100% 100%,0 100%)`;
      },
    };
  });

  React.useEffect(() => {
    state.current.target = level;
    state.current.reduced = reducedMotion;
    wake();
  }, [level, reducedMotion, wake]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % LEVELS.length;
      setLevel(LEVELS[step]!);
    }, FILL_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const scrub = (event: React.PointerEvent) => {
    const tank = tankRef.current;
    if (!tank) return;
    const rect = tank.getBoundingClientRect();
    setTaken(true);
    setLevel(clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1));
  };

  const value = `${Math.round(level * 100)}%`;

  return (
    <div className={styles.slosh}>
      <div className={styles.sloshValue}>
        <TextMorph>{value}</TextMorph>
      </div>

      <div
        className={`${styles.sloshValue} ${styles.sloshOver}`}
        ref={overRef}
        aria-hidden
      >
        <TextMorph>{value}</TextMorph>
      </div>

      <div
        className={styles.tank}
        ref={tankRef}
        role="slider"
        tabIndex={0}
        aria-label="Fill"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        onKeyDown={(event) => {
          const steps: Record<string, number> = {
            ArrowDown: -0.05,
            ArrowLeft: -0.05,
            ArrowUp: 0.05,
            ArrowRight: 0.05,
          };
          const step = steps[event.key];
          if (step === undefined) return;
          event.preventDefault();
          setTaken(true);
          setLevel((value) => clamp(value + step, 0, 1));
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons) scrub(event);
        }}
      >
        <svg
          className={styles.tankLiquid}
          viewBox={`0 0 ${TANK_W} ${TANK_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path ref={pathRef} />
        </svg>
      </div>
    </div>
  );
};

// ── A value you throw ──

export const THROWS = [
  { vx: 9, vy: -12 },
  { vx: -8, vy: -14 },
  { vx: 12, vy: -9 },
  { vx: -11, vy: -11 },
];

const GRAVITY = 0.9;
const RESTITUTION = 0.72;
const AIR = 0.995;
const FLOOR_FRICTION = 0.86;
const SPIN_PER_VX = 1.1;
const REST_VEL = 1.1;
const THROW_EVERY = 4800;

export const ThrowValue = () => {
  const [bounces, setBounces] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const stageRef = React.useRef<HTMLDivElement>(null);
  const puckRef = React.useRef<HTMLDivElement>(null);

  const state = React.useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    grabbed: false,
    from: { x: 0, y: 0 },
    bounces: 0,
    shown: 0,
    max: { x: 0, y: 0 },
  });

  const measure = React.useCallback(() => {
    const stage = stageRef.current;
    const puck = puckRef.current;
    if (!stage || !puck) return;
    const s = state.current;
    s.max = {
      x: Math.max(0, stage.clientWidth - puck.offsetWidth),
      y: Math.max(0, stage.clientHeight - puck.offsetHeight),
    };
  }, []);

  const wake = useMotionLoop(() => {
    const puck = puckRef.current;
    if (!puck) return null;
    const s = state.current;
    measure();
    s.x = s.max.x / 2;
    s.y = s.max.y;

    return {
      step: () => {
        if (s.grabbed) return true;

        s.vy += GRAVITY;
        s.vx *= AIR;
        s.vy *= AIR;
        s.x += s.vx;
        s.y += s.vy;
        s.angle += s.spin;
        s.spin *= 0.98;

        let hit = false;
        if (s.x < 0 || s.x > s.max.x) {
          s.x = clamp(s.x, 0, s.max.x);
          s.vx = -s.vx * RESTITUTION;
          s.spin = -s.spin;
          hit = true;
        }
        if (s.y < 0) {
          s.y = 0;
          s.vy = -s.vy * RESTITUTION;
          hit = true;
        }
        if (s.y >= s.max.y) {
          s.y = s.max.y;
          // Below the rest threshold it has landed, not bounced — or it ticks forever.
          if (Math.abs(s.vy) > REST_VEL) {
            s.vy = -s.vy * RESTITUTION;
            s.vx *= FLOOR_FRICTION;
            s.spin = s.vx * SPIN_PER_VX;
            hit = true;
          } else {
            s.vy = 0;
            s.vx *= 0.9;
            s.spin *= 0.9;
          }
        }

        if (hit) s.bounces += 1;

        if (
          s.y === s.max.y &&
          s.vy === 0 &&
          Math.abs(s.vx) < 0.2 &&
          Math.abs(s.spin) < 0.2
        ) {
          s.vx = 0;
          s.spin = 0;
          s.angle = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        puck.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.angle}deg)`;
        if (s.bounces === s.shown) return;
        s.shown = s.bounces;
        setBounces(s.bounces);
      },
    };
  });

  const fling = React.useCallback(
    (index: number) => {
      const s = state.current;
      const shot = THROWS[index % THROWS.length]!;
      measure();
      s.x = s.max.x / 2;
      s.y = s.max.y;
      s.vx = shot.vx;
      s.vy = shot.vy;
      s.spin = shot.vx * SPIN_PER_VX;
      s.bounces = s.shown = 0;
      setBounces(0);
      wake();
    },
    [measure, wake],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let shot = 0;
    fling(shot);
    const id = window.setInterval(() => fling((shot += 1)), THROW_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, fling]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      measure();
      wake();
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure, wake]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    trigger("selection");
    wake();
  };

  return (
    <div className={styles.arena}>
      <div className={styles.arenaFloor} ref={stageRef}>
        <div
          className={styles.puck}
          ref={puckRef}
          role="button"
          tabIndex={0}
          aria-label={`Throw it again — ${bounces} bounces`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setTaken(true);
            fling(bounces);
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const s = state.current;
            setTaken(true);
            s.grabbed = true;
            s.vx = s.vy = s.spin = 0;
            s.bounces = s.shown = 0;
            setBounces(0);
            s.from = { x: event.clientX - s.x, y: event.clientY - s.y };
            wake();
          }}
          onPointerMove={(event) => {
            const s = state.current;
            if (!s.grabbed) return;
            const x = clamp(event.clientX - s.from.x, 0, s.max.x);
            const y = clamp(event.clientY - s.from.y, 0, s.max.y);
            // The throw is whatever the hand was doing at the moment it let go.
            s.vx = s.vx * 0.4 + (x - s.x) * 0.6;
            s.vy = s.vy * 0.4 + (y - s.y) * 0.6;
            s.x = x;
            s.y = y;
          }}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <TextMorph className={styles.puckValue}>{`${bounces}`}</TextMorph>
        </div>
      </div>

      <span className={styles.caption}>throw it</span>
    </div>
  );
};
