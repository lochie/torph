"use client"; // Mounted by the root layout rather than a surface, so it starts here

import styles from "./styles.module.scss";

import React from "react";
import { usePathname } from "next/navigation";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SpeechBubble } from "@/components/speech-bubble";
import { mascotSpots, type MascotSpot } from "./spots";

// A body and a three-dot tail that only read as one creature because an SVG goo
// filter bridges the gaps between them. He lives on a fixed layer over the page
// and floats between whichever spots components have declared.

const FRAME = 1000 / 60;
const RADIUS = 15; // His body's, and what he stands off an edge by

// The goo filter costs whatever area it covers, so the dots live in a small box
// that travels with him rather than one the size of the page.
const BOX = 120;

// The dots always overlap, so the filter reads them as one tapering shape rather
// than a dotted line — a gap wider than the 4px blur is one it cannot bridge.
const SPACING = 4.5; // Between dots: the whole knob for how long the tail reads
const LINKS = [
  { len: 13, size: 11 }, // Measured off his centre, so this one sits just inside his edge
  { len: SPACING, size: 9 },
  { len: SPACING, size: 7 },
];

const SWAY = 1.7; // Swung this far off vertical the tail sits level with his underside

const REACH = 260; // px of pointer distance he leans within
const LEAN_MAX = 7;
const EYE = 2.4;

type Spring = { mass: number; stiffness: number; damping: number };

// easing.dev's fling: a damping ratio of 1/root 2, the flattest approach that still
// overshoots. Mass is the weight knob — raise it alone and he lumbers and wobbles.
const TRAVEL: Spring = { mass: 1, stiffness: 943, damping: 43.4 };
const LEANING: Spring = { mass: 1, stiffness: 370, damping: 16 };
const TAIL: Spring = { mass: 1, stiffness: 520, damping: 24 };

// Heavier and softer than the fling: trailing a cursor is a drift, not a pounce.
const DRIFT: Spring = { mass: 2.6, stiffness: 420, damping: 42 };
const FOLLOW = 60; // px he keeps between himself and the pointer while adrift

const TOP_SPEED = 6000; // px/s — a governor on page-length jumps, not on the fling
const SQUASH = 0.0012; // Per px/s of speed
const HOP = 540; // The impulse itself: what it does to him depends on his mass
const BOB = 2.5;
const BOB_MS = 3200;

const SPIN = Math.PI * 2; // One turn per page, thrown on the same fling spring

const QUIET = 40; // px/s below which he counts as landed, and can start talking
const DWELL = 15; // Frames landed before he does
const SAY_GAP = 18; // px between him and his bubble

const PICK_EVERY = 10; // Frames between re-reads of every spot's rect
const SWITCH = 90; // px a rival spot has to beat his current one by
const LOST = 20; // Frames before he fades out, so a navigation gap does not blink him
const ADRIFT = 4000; // px of penalty on a perch that has scrolled out of the window
const MARGIN = 48; // Nearer than this to an edge is not somewhere to land
const IDLE = 900; // Frames of a motionless pointer before he nods off
const EDGE = 26; // He never floats off the side of the window

const BREATHE = 0.035;
const BREATHE_MS = 2600;
const DOZING = 1.8; // Breathing runs this much deeper and slower asleep

const TAP_MS = 320; // A short press that went nowhere is a tap, and a tap is a hop
const TAP_PX = 5;

const BLINK_MIN = 2400;
const BLINK_GAP = 4200;
const BLINK_MS = 110;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const STEP = FRAME / 1000; // The loop is fixed at 60Hz, so springs integrate in seconds

// One exact step of a damped spring, in the same mass/stiffness/damping terms as
// torph's own `ease`. `offset` is signed distance to the target, `vel` is px/s.
// Exact rather than integrated: a forward-Euler step at 60Hz eats most of the
// overshoot out of a spring this stiff, and the overshoot is the whole curve.
const advance = (
  { mass, stiffness, damping }: Spring,
  offset: number,
  vel: number,
) => {
  const w = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = Math.exp(-zeta * w * STEP);

  // Past critical the same solution continues with the hyperbolic pair.
  const r = w * Math.sqrt(Math.abs(1 - zeta * zeta));
  const swing = zeta < 1 ? Math.cos(r * STEP) : Math.cosh(r * STEP);
  const reach =
    r < 1e-6 ? STEP : (zeta < 1 ? Math.sin(r * STEP) : Math.sinh(r * STEP)) / r;

  return {
    offset: decay * (offset * swing + (vel + zeta * w * offset) * reach),
    vel: decay * (vel * swing - (w * w * offset + zeta * w * vel) * reach),
  };
};

type Link = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
};

// Laid out along the direction he faces by default, so the first paint is posed.
const restChain = (x: number, y: number): Link[] => {
  const behind = Math.hypot(SWAY, 1);
  let at = { x, y };

  return LINKS.map(({ len }) => {
    at = { x: at.x + (-SWAY / behind) * len, y: at.y + (1 / behind) * len };
    return { ...at, dx: 0, dy: 0, vx: 0, vy: 0 };
  });
};

const place = (x: number, y: number) =>
  `translate(${x}px, ${y}px) translate(-50%, -50%)`;

// The classic squash, oriented along the direction of travel.
const smear = (vx: number, vy: number) => {
  const q = Math.min(Math.hypot(vx, vy) * SQUASH, 0.34);
  if (q < 0.002) return "";
  const angle = Math.atan2(vy, vx);
  return `rotate(${angle}rad) scale(${1 + q}, ${1 - q}) rotate(${-angle}rad)`;
};

const perch = (spot: MascotSpot) => {
  const rect = spot.el.getBoundingClientRect();
  const stand = spot.gap + RADIUS;

  // Corners align him to one end of an edge — far enough in to sit on the box,
  // which leaves his tail to hang over it and the content underneath clear.
  const [vertical, horizontal] = spot.side.split("-");
  const x = horizontal
    ? horizontal === "left"
      ? rect.left + RADIUS
      : rect.right - RADIUS
    : spot.side === "left"
      ? rect.left - stand
      : spot.side === "right"
        ? rect.right + stand
        : rect.left + rect.width / 2;

  const y =
    vertical === "top"
      ? rect.top - stand
      : vertical === "bottom"
        ? rect.bottom + stand
        : rect.top + rect.height / 2;

  return { x, y };
};

export const Mascot = () => {
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const gooId = `mascot-goo-${React.useId().replace(/:/g, "")}`;

  const stageRef = React.useRef<HTMLDivElement>(null);
  const blobRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const faceRef = React.useRef<HTMLDivElement>(null);
  const hitRef = React.useRef<HTMLDivElement>(null);
  const sayRef = React.useRef<HTMLDivElement>(null);
  const route = React.useRef<string | null>(null);
  const tailRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const [blinking, setBlinking] = React.useState(false);
  const [asleep, setAsleep] = React.useState(false);
  const [say, setSay] = React.useState({
    line: "",
    show: false,
    tail: "right" as "left" | "right",
  });

  const state = React.useRef({
    x: 0, // Where he is, in viewport space
    y: 0,
    vx: 0,
    vy: 0,
    lx: 0, // The lean toward the pointer, kept apart from the travel so it stays snappy
    ly: 0,
    lvx: 0,
    lvy: 0,
    tail: restChain(0, 0),
    ex: 0,
    ey: 0,
    px: 0, // Pointer, in viewport space
    py: 0,
    seen: false,
    grabX: 0,
    grabY: 0,
    grabbed: false,
    spot: null as MascotSpot | null,
    placed: false,
    loose: false, // His perch has scrolled off, so he trails the pointer instead
    idle: 0,
    dozing: false,
    phase: 0,
    lost: 0, // Frames with nowhere to sit — long enough, and he leaves
    spin: 0,
    spinTo: 0,
    spinVel: 0,
    tick: 0,
    dwell: 0,
    turn: 0, // Which of the spot's lines he is on
    saying: null as string | null,
    said: "", // Held while hidden, so the bubble does not empty on its way out
    side: "right" as "left" | "right",
  });

  React.useEffect(() => {
    const stage = stageRef.current;
    const blob = blobRef.current;
    const body = bodyRef.current;
    const face = faceRef.current;
    const hit = hitRef.current;
    if (!stage || !blob || !body || !face || !hit) return;

    const s = state.current;

    const aimAt = () => ({
      x: s.seen ? s.px : window.innerWidth / 2,
      y: s.seen ? s.py : window.innerHeight / 2,
    });

    const adrift = ({ x, y }: { x: number; y: number }) =>
      y < MARGIN ||
      y > window.innerHeight - MARGIN ||
      x < 0 ||
      x > window.innerWidth;

    const pick = () => {
      if (s.spot && !mascotSpots().has(s.spot)) s.spot = null;

      const aim = aimAt();
      const rate = (spot: MascotSpot) => {
        const at = perch(spot);
        return (
          Math.hypot(at.x - aim.x, at.y - aim.y) -
          spot.pull +
          (adrift(at) ? ADRIFT : 0)
        );
      };

      let best: MascotSpot | null = null;
      let score = Infinity;

      for (const spot of mascotSpots()) {
        const rated = rate(spot);
        if (rated < score) {
          score = rated;
          best = spot;
        }
      }

      // A rival has to beat where he is sitting by a clear margin, or he dithers.
      if (best && (!s.spot || score < rate(s.spot) - SWITCH)) {
        if (best !== s.spot) s.turn = 0;
        s.spot = best;
      }

      s.loose = s.seen && s.spot ? adrift(perch(s.spot)) : false;
    };

    // He opens his mouth only once he has landed, but having opened it he keeps it
    // open all the way to anywhere else with something to say — the morph carries.
    const talk = (landed: boolean) => {
      const lines = s.spot?.says ?? [];
      const next = lines.length ? lines[s.turn % lines.length]! : null;

      // Adrift he says nothing at all; asleep he says only the one thing.
      const line = s.loose
        ? null
        : s.dozing
          ? "zzz"
          : next && (landed || s.saying)
            ? next
            : null;
      const side = s.x > window.innerWidth / 2 ? "right" : "left";
      if (line === s.saying && side === s.side) return;

      s.saying = line;
      s.side = side;
      if (line) s.said = line;
      setSay({ line: s.said, show: line !== null, tail: side });
    };

    // Dropped straight onto his spot rather than flown to it — for the first
    // paint, and for arriving on a page after a spell with nowhere to be.
    const settle = () => {
      pick();
      if (!s.spot) return false;

      const at = perch(s.spot);
      s.x = clamp(at.x, EDGE, window.innerWidth - EDGE);
      s.y = at.y;
      s.vx = 0;
      s.vy = 0;
      s.tail = restChain(s.x, s.y);
      s.placed = true;
      return true;
    };

    const paint = () => {
      const swell = Math.sin(s.phase) * BREATHE * (s.dozing ? DOZING : 1);
      const breathe = `scale(${1 + swell}, ${1 - swell})`;
      const pose = `${smear(s.vx + s.lvx, s.vy + s.lvy)} ${breathe}`;

      const x = s.x + s.lx;
      const y = s.y + s.ly;

      // Everything under the filter is drawn relative to the box's own centre.
      const local = (wx: number, wy: number) =>
        place(BOX / 2 + wx - s.x, BOX / 2 + wy - s.y);

      stage.style.opacity = s.placed && s.lost <= LOST ? "1" : "0";
      blob.style.transform = `${place(s.x, s.y)} rotate(${s.spin}rad)`;
      body.style.transform = `${local(x, y)} ${pose}`;
      face.style.transform = `${place(x + s.ex, y + s.ey)} rotate(${s.spin}rad) ${pose}`;
      hit.style.transform = place(x, y);

      const bubble = sayRef.current;
      if (bubble) {
        // Anchored by its own bottom corner, then kept inside the window.
        const w = bubble.offsetWidth;
        const edge = s.side === "right" ? x - SAY_GAP - w : x + SAY_GAP;
        bubble.style.transform = `translate(${clamp(edge, 8, window.innerWidth - w - 8)}px, ${Math.max(
          y - SAY_GAP,
          bubble.offsetHeight + 8,
        )}px) translate(0, -100%)`;
      }

      s.tail.forEach((link, i) => {
        const dot = tailRefs.current[i];
        if (dot)
          dot.style.transform = `${local(link.x, link.y)} ${smear(link.dx, link.dy)}`;
      });
    };

    if (reducedMotion) {
      // Pinned to his spot rather than sprung at it: he moves only when the page does.
      const pin = () => {
        if (!settle()) return;
        talk(true);
        paint();
      };

      pin();
      window.addEventListener("scroll", pin, { passive: true });
      window.addEventListener("resize", pin);
      return () => {
        window.removeEventListener("scroll", pin);
        window.removeEventListener("resize", pin);
      };
    }

    const step = () => {
      // Checked every frame, not every pick: a spot whose page has navigated away
      // measures as a rect at the origin, and he would dive for the corner.
      if (s.spot && !mascotSpots().has(s.spot)) s.spot = null;

      s.tick += 1;
      if (!s.spot || s.tick % PICK_EVERY === 0) pick();
      if (s.spot && s.lost > LOST) settle(); // Faded out: he reappears there, not in flight
      s.lost = s.spot ? 0 : s.lost + 1;

      const spun = advance(TRAVEL, s.spin - s.spinTo, s.spinVel);
      s.spin = s.spinTo + spun.offset;
      s.spinVel = spun.vel;

      if (s.grabbed) {
        const nx = s.px - s.grabX;
        const ny = s.py - s.grabY;
        s.vx = (nx - s.x) / STEP;
        s.vy = (ny - s.y) / STEP;
        s.x = nx;
        s.y = ny;
      } else if (s.spot) {
        const bob =
          Math.sin((s.tick * STEP * 1000 * Math.PI * 2) / BOB_MS) * BOB;

        let to = perch(s.spot);
        if (s.loose) {
          // Nowhere on screen to sit, so he keeps station off the pointer instead —
          // holding his distance means he only moves when you leave him behind.
          const aim = aimAt();
          const away = Math.hypot(s.x - aim.x, s.y - aim.y) || 1;
          to = {
            x: aim.x + ((s.x - aim.x) / away) * FOLLOW,
            y: aim.y + ((s.y - aim.y) / away) * FOLLOW,
          };
        }

        const spring = s.loose ? DRIFT : TRAVEL;
        const tx = clamp(to.x, EDGE, window.innerWidth - EDGE);
        const ty = to.y + bob;

        const flungX = advance(spring, s.x - tx, s.vx);
        const flungY = advance(spring, s.y - ty, s.vy);

        s.x = tx + flungX.offset;
        s.y = ty + flungY.offset;
        s.vx = flungX.vel;
        s.vy = flungY.vel;

        const speed = Math.hypot(s.vx, s.vy);
        if (speed > TOP_SPEED) {
          s.vx = (s.vx / speed) * TOP_SPEED;
          s.vy = (s.vy / speed) * TOP_SPEED;
        }
      }

      // Leaning is sprung apart from travelling, so it stays quick over a slow float.
      const dx = s.seen ? s.px - s.x : 0;
      const dy = s.seen ? s.py - s.y : 0;
      const dist = Math.hypot(dx, dy) || 1;
      const near = s.dozing ? 0 : clamp(1 - dist / REACH, 0, 1) ** 2;

      const wantLX = clamp(dx * 0.16, -LEAN_MAX, LEAN_MAX) * near;
      const wantLY = clamp(dy * 0.16, -LEAN_MAX, LEAN_MAX) * near;
      const leanX = advance(LEANING, s.lx - wantLX, s.lvx);
      const leanY = advance(LEANING, s.ly - wantLY, s.lvy);

      s.lx = wantLX + leanX.offset;
      s.ly = wantLY + leanY.offset;
      s.lvx = leanX.vel;
      s.lvy = leanY.vel;

      s.idle += 1;
      const dozing = s.idle > IDLE;
      if (dozing !== s.dozing) {
        s.dozing = dozing;
        setAsleep(dozing);
      }

      s.phase +=
        (Math.PI * 2 * STEP * 1000) / (BREATHE_MS * (dozing ? DOZING : 1));

      const still = !s.grabbed && Math.hypot(s.vx, s.vy) < QUIET;
      s.dwell = still ? s.dwell + 1 : 0;
      talk(s.dwell > DWELL);

      // The eyes track from anywhere on the page, however far off the body leans.
      const reach = s.dozing ? 0 : EYE * Math.min(dist / 8, 1);
      const ex = (dx / dist) * reach;
      const ey = (dy / dist) * reach;
      s.ex += (ex - s.ex) * 0.16;
      s.ey += (ey - s.ey) * 0.16;

      // The tail sits behind him — from a sitting position that means bottom-centre,
      // swung away from whatever he is looking at.
      const gaze = Math.hypot(s.ex, s.ey);
      const bx = (gaze > 0.01 ? -s.ex / gaze : -1) * SWAY; // Nothing to look at yet: he faces right
      const behind = Math.hypot(bx, 1);

      let px = s.x + s.lx;
      let py = s.y + s.ly;
      let dirX = bx / behind;
      let dirY = 1 / behind;

      for (let i = 0; i < LINKS.length; i += 1) {
        const link = s.tail[i]!;
        const { len } = LINKS[i]!;

        // Each dot is sprung at wherever the one in front is pointing and then roped
        // to it: the spring is what straightens the tail, the rope is what trails it.
        const wasX = link.x;
        const wasY = link.y;

        const wantX = px + dirX * len;
        const wantY = py + dirY * len;
        const chasedX = advance(TAIL, link.x - wantX, link.vx);
        const chasedY = advance(TAIL, link.y - wantY, link.vy);

        link.x = wantX + chasedX.offset;
        link.y = wantY + chasedY.offset;
        link.vx = chasedX.vel;
        link.vy = chasedY.vel;

        const ox = link.x - px;
        const oy = link.y - py;
        const reach = Math.hypot(ox, oy) || 1;
        const held = clamp(reach, len * 0.55, len);
        link.x = px + (ox / reach) * held;
        link.y = py + (oy / reach) * held;

        link.dx = (link.x - wasX) / STEP;
        link.dy = (link.y - wasY) / STEP;

        dirX = (link.x - px) / held;
        dirY = (link.y - py) / held;
        px = link.x;
        py = link.y;
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), 120);
      last = now;

      // Deferred to the first frame: every spot's own effect has registered by now.
      if (!s.placed) settle();

      while (acc >= FRAME) {
        step();
        acc -= FRAME;
      }

      paint();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const pathname = usePathname();

  React.useEffect(() => {
    // Nothing on the first render — he has not gone anywhere yet.
    if (route.current === pathname) return;
    const first = route.current === null;
    route.current = pathname;
    if (first || reducedMotion) return;

    state.current.spinTo += SPIN;
  }, [pathname, reducedMotion]);

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const s = state.current;
      if (s.dozing) s.lvy -= HOP / 2 / LEANING.mass; // Startled awake
      s.px = event.clientX;
      s.py = event.clientY;
      s.seen = true;
      s.idle = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  React.useEffect(() => {
    if (reducedMotion) return;

    let open = 0;
    let shut = 0;

    const schedule = () => {
      open = window.setTimeout(
        () => {
          setBlinking(true);
          shut = window.setTimeout(() => {
            setBlinking(false);
            schedule();
          }, BLINK_MS);
        },
        BLINK_MIN + Math.random() * BLINK_GAP,
      );
    };

    schedule();
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(shut);
    };
  }, [reducedMotion]);

  const press = React.useRef({ at: 0, x: 0, y: 0 });

  return (
    <div className={styles.mascot} ref={stageRef} aria-hidden>
      <svg className={styles.defs}>
        <defs>
          <filter id={gooId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className={styles.blob}
        ref={blobRef}
        style={{ width: BOX, height: BOX, filter: `url(#${gooId})` }}
      >
        <div className={styles.body} ref={bodyRef} />
        {LINKS.map(({ size }, i) => (
          <div
            key={i}
            className={styles.tail}
            ref={(dot) => {
              tailRefs.current[i] = dot;
            }}
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      <div
        className={styles.face}
        ref={faceRef}
        data-blink={blinking || asleep}
        data-asleep={asleep}
      >
        <span className={styles.eye} />
        <span className={styles.eye} />
      </div>

      <div className={styles.say} ref={sayRef} data-show={say.show}>
        <SpeechBubble message={say.line} tail={say.tail} />
      </div>

      <div
        className={styles.hit}
        ref={hitRef}
        onPointerDown={(event) => {
          if (reducedMotion) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const s = state.current;
          s.grabbed = true;
          s.px = event.clientX;
          s.py = event.clientY;
          s.seen = true;
          s.grabX = event.clientX - s.x;
          s.grabY = event.clientY - s.y;
          press.current = {
            at: performance.now(),
            x: event.clientX,
            y: event.clientY,
          };
          trigger("selection");
        }}
        onPointerUp={(event) => {
          const s = state.current;
          if (!s.grabbed) return;
          s.grabbed = false;

          const held = performance.now() - press.current.at;
          const moved = Math.hypot(
            event.clientX - press.current.x,
            event.clientY - press.current.y,
          );

          if (held < TAP_MS && moved < TAP_PX) {
            s.lvy -= HOP / LEANING.mass;
            s.turn += 1; // Next thing he has to say about this spot
            trigger("light");
          }
        }}
        onPointerCancel={() => {
          state.current.grabbed = false;
        }}
      />
    </div>
  );
};
