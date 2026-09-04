import styles from "./inline.module.scss";

import React from "react";
import { Reorder, arc } from "motion/react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMotionLoop } from "./use-motion-loop";

// ── A pill that stretches between tabs ──

export const TABS = ["Overview", "Activity", "Members", "Settings"];

const TAB_STIFFNESS = 0.17;
const TAB_DAMPING = 0.68;
const TAB_STRETCH = 0.009; // scaleX added per px/frame of travel
const TAB_EVERY = 2400;

export const ElasticTabs = () => {
  const [active, setActive] = React.useState(0);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const rowRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const state = React.useRef({ x: 0, vel: 0, active: 0, reduced: false });

  // Layout offsets, so neither the pill's own stretch nor the row's is measured in.
  const centreOf = (index: number) => {
    const tab = tabRefs.current[index];
    return tab ? tab.offsetLeft + tab.offsetWidth / 2 : 0;
  };

  const wake = useMotionLoop(() => {
    const pill = pillRef.current;
    if (!pill) return null;
    const s = state.current;
    s.x = centreOf(s.active);

    return {
      step: () => {
        const target = centreOf(s.active);
        if (s.reduced) {
          s.x = target;
          s.vel = 0;
          return false;
        }

        s.vel = (s.vel + (target - s.x) * TAB_STIFFNESS) * TAB_DAMPING;
        s.x += s.vel;

        if (Math.abs(s.vel) < 0.05 && Math.abs(target - s.x) < 0.1) {
          s.x = target;
          s.vel = 0;
          return false;
        }
        return true;
      },
      paint: () => {
        pill.style.transform = `translateX(${s.x}px) translateX(-50%) scaleX(${
          1 + Math.abs(s.vel) * TAB_STRETCH
        })`;
      },
    };
  });

  React.useEffect(() => {
    state.current.active = active;
    state.current.reduced = reducedMotion;
    wake();
  }, [active, reducedMotion, wake]);

  React.useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(() => wake());
    observer.observe(row);
    return () => observer.disconnect();
  }, [wake]);

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % TABS.length),
      TAB_EVERY,
    );
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  return (
    <div
      className={styles.tabs}
      ref={rowRef}
      role="tablist"
      aria-label="Section"
    >
      <div className={styles.tabPill} ref={pillRef} aria-hidden>
        <TextMorph className={styles.tabPillLabel}>{TABS[active]!}</TextMorph>
      </div>

      {TABS.map((label, i) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={i === active}
          className={styles.tab}
          data-active={i === active}
          ref={(node) => {
            tabRefs.current[i] = node;
          }}
          onClick={() => {
            if (i !== active) trigger("selection");
            setTaken(true);
            setActive(i);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

// ── A list that ripples ──

export const TRACKS = ["Ambient loops", "Field recordings", "Tape hiss"];

const RIPPLE = 0.025; // Seconds a row waits per row of distance from the one that moved
const SHUFFLE_EVERY = 2600;
const SHUFFLES = [
  [4, 0],
  [1, 3],
  [0, 2],
  [3, 1],
  [2, 4],
];

const SETTLE = { type: "spring", stiffness: 520, damping: 34 } as const;
// Slower than SETTLE: the idle row is being carried, not sprung into place.
const CARRY = { type: "spring", stiffness: 210, damping: 26 } as const;

const LIFT = 260; // ms the idle row is held up before it travels
const CARRIED = 700; // ms it stays up while travelling, so it sets down after it lands
const DIMMED = 0.4; // Opacity of the rows a lifted row is passing
const BOW = 16; // px the lifted row swings out — `path` can't reach it, see below

export const ReorderList = () => {
  const [order, setOrder] = React.useState(() => TRACKS.map((_, i) => i));
  const [pivot, setPivot] = React.useState(0);
  const [dragging, setDragging] = React.useState(-1);
  const [carried, setCarried] = React.useState(-1);
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const orderRef = React.useRef(order);
  React.useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // Idle, the list mimes a drag — lift, carry, drop — so the gesture reads before it is tried.
  React.useEffect(() => {
    if (taken || reducedMotion) return;
    let shuffle = 0;
    const timers: number[] = [];

    const id = window.setInterval(() => {
      const [from, to] = SHUFFLES[shuffle % SHUFFLES.length]!;
      shuffle += 1;
      const moved = orderRef.current[from!]!;
      setCarried(moved);

      timers.push(
        window.setTimeout(() => {
          setPivot(to!);
          setOrder((current) => {
            const next = current.slice();
            next.splice(to!, 0, next.splice(current.indexOf(moved), 1)[0]!);
            return next;
          });
        }, LIFT),
      );
      timers.push(window.setTimeout(() => setCarried(-1), LIFT + CARRIED));
    }, SHUFFLE_EVERY);

    return () => {
      window.clearInterval(id);
      timers.forEach(window.clearTimeout);
      setCarried(-1);
    };
  }, [taken, reducedMotion]);

  const move = (id: number, step: number) => {
    setTaken(true);
    setOrder((current) => {
      const from = current.indexOf(id);
      const to = Math.min(Math.max(from + step, 0), current.length - 1);
      if (to === from) return current;
      const next = current.slice();
      next.splice(to, 0, next.splice(from, 1)[0]!);
      setPivot(to);
      trigger("selection");
      return next;
    });
  };

  return (
    <div className={styles.reorder}>
      <Reorder.Group
        axis="y"
        as="ul"
        values={order}
        onReorder={(next: number[]) => {
          setPivot(dragging < 0 ? 0 : next.indexOf(dragging));
          setOrder(next);
          trigger("selection");
        }}
        className={styles.reorderList}
      >
        {order.map((id, slot) => (
          <Reorder.Item
            key={id}
            value={id}
            className={styles.row}
            tabIndex={0}
            aria-label={`${TRACKS[id]}, position ${slot + 1}`}
            // Rows nearest the one that moved set off first, which is the ripple.
            transition={{
              ...(id === carried ? CARRY : SETTLE),
              delay:
                id === dragging || id === carried
                  ? 0
                  : Math.abs(slot - pivot) * RIPPLE,
              path: arc({
                strength: 2,
              }),
              opacity: { duration: 0.22, delay: 0 },
              scale: { type: "spring", stiffness: 420, damping: 30, delay: 0 },
              boxShadow: { duration: 0.22, delay: 0 },
              x: {
                duration: 0.55,
                ease: "easeInOut",
                times: [0, 0.5, 1],
                delay: LIFT / 1000,
              },
            }}
            animate={{
              scale: id === carried ? 1.03 : 1,
              opacity: carried < 0 || id === carried ? 1 : DIMMED,
              boxShadow:
                id === carried
                  ? "0 0.75rem 1.5rem rgba(0, 0, 0, 0.45)"
                  : "0 0rem 0rem rgba(0, 0, 0, 0)",
              // `transition.path` only curves layout moves, and Reorder.Item drives
              // the row it is carrying off `x`/`y` instead — so bow that by hand.
              x: id === carried ? [0, BOW, 0] : 0,
            }}
            // Lifted, so a row still catching up passes underneath it.
            whileDrag={{
              scale: 1.03,
              zIndex: 2,
              boxShadow: "0 0.75rem 1.5rem rgba(0, 0, 0, 0.45)",
            }}
            onDragStart={() => {
              setTaken(true);
              setDragging(id);
            }}
            onDragEnd={() => setDragging(-1)}
            onKeyDown={(event: React.KeyboardEvent) => {
              const step =
                event.key === "ArrowUp"
                  ? -1
                  : event.key === "ArrowDown"
                    ? 1
                    : 0;
              if (!step) return;
              event.preventDefault();
              move(id, step);
            }}
          >
            <TextMorph className={styles.rowIndex}>{`${slot + 1}`}</TextMorph>
            <span className={styles.rowLabel}>{TRACKS[id]}</span>
            <span className={styles.rowGrip} aria-hidden />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
};
