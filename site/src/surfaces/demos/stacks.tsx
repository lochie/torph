import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clamp, useMotionLoop } from "./use-motion-loop";

const ROW_H = 40; // px, and the row pitch in the stylesheet

// ── A gap you spread ──

export const PARTS = [
  "Intro",
  "Verse",
  "Chorus",
  "Bridge",
  "Solo",
  "Outro",
  "Refrain",
  "Coda",
];

const SEAM_INSERT = 38; // px of spread before a row is born in the gap
const SEAM_DELETE = 30; // px of squeeze before the row below is crushed out
const SEAM_STIFFNESS = 0.26;
const SEAM_DAMPING = 0.56;
const POP_STIFFNESS = 0.24;
const POP_DAMPING = 0.5;
const SPREAD_EVERY = 2300;

type Row = {
  id: number;
  label: string;
  pop: number;
  popVel: number;
  dying: boolean;
};

export const SpreadInsert = () => {
  const [rows, setRows] = React.useState<Row[]>(() =>
    PARTS.slice(0, 4).map((label, i) => ({
      id: i,
      label,
      pop: 1,
      popVel: 0,
      dying: false,
    })),
  );
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const rowRefs = React.useRef(new Map<number, HTMLDivElement>());

  const state = React.useRef({
    rows: PARTS.slice(0, 4).map((label, i) => ({
      id: i,
      label,
      pop: 1,
      popVel: 0,
      dying: false,
    })),
    seam: -1,
    pull: 0,
    vel: 0,
    grabbed: false,
    from: 0,
    seed: PARTS.length,
    tick: 0,
  });

  const publish = () => setRows(state.current.rows.slice());

  const wake = useMotionLoop(() => {
    const s = state.current;

    return {
      step: () => {
        let moving = false;

        if (!s.grabbed) {
          s.vel = (s.vel - s.pull * SEAM_STIFFNESS) * SEAM_DAMPING;
          s.pull += s.vel;
          if (Math.abs(s.vel) < 0.05 && Math.abs(s.pull) < 0.2) {
            s.pull = 0;
            s.vel = 0;
          } else {
            moving = true;
          }
        } else {
          moving = true;
        }

        let buried = false;
        for (const row of s.rows) {
          const target = row.dying ? 0 : 1;
          row.popVel =
            (row.popVel + (target - row.pop) * POP_STIFFNESS) * POP_DAMPING;
          row.pop += row.popVel;
          if (row.dying && row.pop < 0.06) buried = true;
          else if (
            Math.abs(row.popVel) > 0.002 ||
            Math.abs(target - row.pop) > 0.004
          ) {
            moving = true;
          }
        }

        if (buried) {
          s.rows = s.rows.filter((row) => !(row.dying && row.pop < 0.06));
          publish();
          moving = true;
        }

        return moving;
      },
      paint: () => {
        const spread = clamp(s.pull, -ROW_H, ROW_H);
        s.rows.forEach((row, i) => {
          const node = rowRefs.current.get(row.id);
          if (!node) return;
          const shove = s.seam >= 0 && i >= s.seam ? spread : 0;
          node.style.transform = `translateY(${i * ROW_H + shove}px) scale(${row.pop})`;
          node.style.opacity = `${clamp(row.pop, 0, 1)}`;
        });
      },
    };
  });

  const insertAt = React.useCallback(
    (seam: number) => {
      const s = state.current;
      s.seed += 1;
      // Born small in the gap it was pulled out of.
      s.rows.splice(seam, 0, {
        id: s.seed,
        label: PARTS[s.seed % PARTS.length]!,
        pop: 0.2,
        popVel: 0,
        dying: false,
      });
      s.pull = 0;
      s.vel = 0;
      publish();
      trigger("selection");
      wake();
    },
    [trigger, wake],
  );

  const crushAt = React.useCallback(
    (seam: number) => {
      const s = state.current;
      const row = s.rows[seam];
      if (!row || s.rows.length <= 2) return;
      row.dying = true;
      s.pull = 0;
      s.vel = 0;
      publish();
      trigger("selection");
      wake();
    },
    [trigger, wake],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const s = state.current;
      s.tick += 1;
      const seam = 1 + (s.tick % 2);
      s.seam = seam;
      if (s.rows.length >= 6) crushAt(seam);
      else insertAt(seam);
    }, SPREAD_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, insertAt, crushAt]);

  const release = () => {
    const s = state.current;
    if (!s.grabbed) return;
    s.grabbed = false;
    wake();
  };

  return (
    <div
      className={styles.spread}
      style={{ height: `${rows.length * ROW_H}px` }}
    >
      {rows.map((row, i) => (
        <div
          key={row.id}
          className={styles.spreadRow}
          ref={(node) => {
            if (node) rowRefs.current.set(row.id, node);
            else rowRefs.current.delete(row.id);
          }}
        >
          <TextMorph className={styles.spreadIndex}>{`${i + 1}`}</TextMorph>
          <span className={styles.spreadLabel}>{row.label}</span>
        </div>
      ))}

      {/* One grabbable seam per gap, sitting over the boundary between two rows. */}
      {rows.map((row, i) => (
        <span
          key={`seam-${row.id}`}
          className={styles.seam}
          style={{ top: `${i * ROW_H}px` }}
          role="button"
          tabIndex={0}
          aria-label={`Spread to add above ${row.label}, squeeze to remove it`}
          onKeyDown={(event) => {
            const dir =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            if (!dir) return;
            event.preventDefault();
            setTaken(true);
            state.current.seam = i;
            if (dir > 0) insertAt(i);
            else crushAt(i);
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const s = state.current;
            setTaken(true);
            s.grabbed = true;
            s.seam = i;
            s.from = event.clientY - s.pull;
            wake();
          }}
          onPointerMove={(event) => {
            const s = state.current;
            if (!s.grabbed || s.seam !== i) return;
            s.pull = event.clientY - s.from;
            if (s.pull < SEAM_INSERT && s.pull > -SEAM_DELETE) return;
            // Re-anchored, so holding on keeps adding rather than adding every frame.
            if (s.pull > 0) insertAt(i);
            else crushAt(i);
            s.from = event.clientY;
          }}
          onPointerUp={release}
          onPointerCancel={release}
        />
      ))}
    </div>
  );
};

// ── A block you pull out ──

export const TOWER = 6;

const JENGA_GRAVITY = 1.5;
const JENGA_BOUNCE = -0.32;
const JENGA_LAG = 3; // Frames each block waits behind the one below it
const JENGA_YANK = 46; // px sideways before the block comes free
const JENGA_EVERY = 2600;

type Block = {
  id: number;
  y: number;
  vel: number;
  wait: number;
  x: number;
  spin: number;
  angle: number;
  flying: boolean;
};

const makeBlock = (id: number, y: number): Block => ({
  id,
  y,
  vel: 0,
  wait: 0,
  x: 0,
  spin: 0,
  angle: 0,
  flying: false,
});

export const JengaPull = () => {
  const [blocks, setBlocks] = React.useState<Block[]>(() =>
    Array.from({ length: TOWER }, (_, i) =>
      makeBlock(i, (TOWER - 1 - i) * ROW_H),
    ),
  );
  const [taken, setTaken] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const blockRefs = React.useRef(new Map<number, HTMLDivElement>());

  const state = React.useRef({
    blocks: Array.from({ length: TOWER }, (_, i) =>
      makeBlock(i, (TOWER - 1 - i) * ROW_H),
    ),
    held: -1,
    from: 0,
    seed: TOWER,
  });

  const publish = () => setBlocks(state.current.blocks.slice());

  // Numbered from the bottom, so the blocks that fall are the ones that renumber.
  const standing = (s: { blocks: Block[] }) =>
    s.blocks.filter((block) => !block.flying);

  const wake = useMotionLoop(() => {
    const s = state.current;

    return {
      step: () => {
        let moving = false;
        const rows = standing(s);

        rows.forEach((block, slot) => {
          if (block.id === s.held) return;
          const target = (rows.length - 1 - slot) * ROW_H;
          if (block.wait > 0) {
            block.wait -= 1;
            moving = true;
            return;
          }
          if (block.y === target && block.vel === 0) return;

          block.vel += JENGA_GRAVITY;
          block.y += block.vel;
          if (block.y >= target) {
            block.y = target;
            block.vel = Math.abs(block.vel) > 2 ? block.vel * JENGA_BOUNCE : 0;
          }
          moving = true;
        });

        let landed = false;
        for (const block of s.blocks) {
          if (!block.flying) continue;
          block.vel += JENGA_GRAVITY;
          block.x += block.spin * 0.6;
          block.y += block.vel;
          block.angle += block.spin;
          if (block.y > 320) landed = true;
          moving = true;
        }
        if (landed) {
          s.blocks = s.blocks.filter(
            (block) => !(block.flying && block.y > 320),
          );
          publish();
        }

        return moving || s.held >= 0;
      },
      paint: () => {
        for (const block of s.blocks) {
          const node = blockRefs.current.get(block.id);
          if (!node) continue;
          node.style.transform = `translate(${block.x}px, ${block.y}px) rotate(${block.angle}deg)`;
        }
      },
    };
  });

  const yank = React.useCallback(
    (id: number, vx: number) => {
      const s = state.current;
      const rows = standing(s);
      const slot = rows.findIndex((block) => block.id === id);
      const block = rows[slot];
      if (!block || rows.length <= 2) return;

      block.flying = true;
      block.vel = -6;
      block.spin = vx > 0 ? 11 : -11;
      // Everything above drops, the block nearest the hole first.
      rows.slice(slot + 1).forEach((above, i) => {
        above.wait = i * JENGA_LAG;
      });

      // Pushed, not unshifted: a fresh block belongs on top of the tower, and
      // the top is the end of the array.
      if (rows.length <= 3) {
        for (let i = 0; i < 3; i += 1) {
          s.seed += 1;
          s.blocks.push(makeBlock(s.seed, -140 - i * ROW_H));
        }
      }

      s.held = -1;
      publish();
      trigger("selection");
      wake();
    },
    [trigger, wake],
  );

  React.useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      const rows = standing(state.current);
      const pick = rows[Math.floor(rows.length / 2)];
      if (pick) yank(pick.id, 1);
    }, JENGA_EVERY);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion, yank]);

  const rows = blocks.filter((block) => !block.flying);

  return (
    <div className={styles.tower} style={{ height: `${TOWER * ROW_H}px` }}>
      {blocks.map((block) => {
        const slot = rows.findIndex((row) => row.id === block.id);
        // Slot 0 sits at the bottom of the tower, and the bottom is number one.
        const number = slot + 1;
        return (
          <div
            key={block.id}
            className={`${styles.block} ${block.flying ? styles.blockGone : ""}`}
            ref={(node) => {
              if (node) blockRefs.current.set(block.id, node);
              else blockRefs.current.delete(block.id);
            }}
            role={block.flying ? undefined : "button"}
            tabIndex={block.flying ? undefined : 0}
            aria-hidden={block.flying || undefined}
            aria-label={block.flying ? undefined : `Pull block ${number} out`}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setTaken(true);
              yank(block.id, 1);
            }}
            onPointerDown={(event) => {
              if (block.flying) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const s = state.current;
              setTaken(true);
              s.held = block.id;
              s.from = event.clientX;
              wake();
            }}
            onPointerMove={(event) => {
              const s = state.current;
              if (s.held !== block.id) return;
              block.x = event.clientX - s.from;
              if (Math.abs(block.x) > JENGA_YANK) yank(block.id, block.x);
            }}
            onPointerUp={() => {
              const s = state.current;
              if (s.held !== block.id) return;
              s.held = -1;
              block.x = 0;
              wake();
            }}
          >
            {block.flying ? null : (
              <TextMorph
                className={styles.blockNumber}
              >{`${number}`}</TextMorph>
            )}
          </div>
        );
      })}
    </div>
  );
};
