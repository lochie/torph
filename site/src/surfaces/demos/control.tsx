import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

import { Button } from "@/components/button";
import { useCycle } from "./use-cycle";

export const SPRING_LABELS = ["Save changes", "Saved", "Save changes to draft"];

export const EASINGS = {
  spring: { stiffness: 200, damping: 20 },
  bezier: "cubic-bezier(0.19, 1, 0.22, 1)",
} as const;

type Kind = keyof typeof EASINGS;

export const Spring = () => {
  const [index, setIndex] = React.useState(0);
  const [kind, setKind] = React.useState<Kind>("spring");

  return (
    <>
      <div className={styles.stage}>
        <TextMorph ease={EASINGS[kind]}>{SPRING_LABELS[index]!}</TextMorph>
      </div>

      <div className={styles.controls}>
        {(Object.keys(EASINGS) as Kind[]).map((k) => (
          <Button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {k}
          </Button>
        ))}

        <Button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % SPRING_LABELS.length)}
        >
          Morph
        </Button>
      </div>
    </>
  );
};

export const INTERRUPT = ["1,024", "1,318", "1,207", "1,455", "1,390"];

export const Interrupt = () => {
  const [fast, setFast] = React.useState(true);
  const [tally, setTally] = React.useState({ completed: 0, cancelled: 0 });
  const index = useCycle(INTERRUPT.length, fast ? 220 : 1000);

  return (
    <>
      <TextMorph
        className={`${styles.stage} ${styles.stageLarge} ${styles.tabular}`}
        // Functional: a handler captured at attach time reads a stale tally.
        onAnimationComplete={() =>
          setTally((t) => ({ ...t, completed: t.completed + 1 }))
        }
        onAnimationCancel={() =>
          setTally((t) => ({ ...t, cancelled: t.cancelled + 1 }))
        }
      >
        {INTERRUPT[index]!}
      </TextMorph>

      <div className={styles.counters}>
        <div className={styles.counter}>
          <TextMorph className={`${styles.stage} ${styles.stageSmall}`}>
            {tally.completed}
          </TextMorph>
          <span className={styles.caption}>completed</span>
        </div>

        <div className={styles.counter}>
          <TextMorph className={`${styles.stage} ${styles.stageSmall}`}>
            {tally.cancelled}
          </TextMorph>
          <span className={styles.caption}>cancelled</span>
        </div>
      </div>

      <div className={styles.controls}>
        <Button type="button" onClick={() => setFast((f) => !f)}>
          {fast ? "220ms interval" : "1000ms interval"}
        </Button>
      </div>
    </>
  );
};

export const DISABLED = ["12,480", "13,905", "9,847", "10,006"];

export const Disabled = () => {
  const [disabled, setDisabled] = React.useState(false);
  const index = useCycle(DISABLED.length, 1600);

  return (
    <>
      <TextMorph
        className={`${styles.stage} ${styles.stageLarge} ${styles.tabular}`}
        disabled={disabled}
      >
        {DISABLED[index]!}
      </TextMorph>

      <div className={styles.controls}>
        <Button
          type="button"
          aria-pressed={disabled}
          onClick={() => setDisabled((d) => !d)}
        >
          {disabled ? "Animation off" : "Animation on"}
        </Button>
      </div>
    </>
  );
};

export const EMPTYING = ["$420", "$42", "$4", "$", "", "$", "$4", "$42"];

export const Emptying = () => {
  const index = useCycle(EMPTYING.length, 700);

  return (
    <TextMorph className={`${styles.stage} ${styles.stageLarge}`}>
      {EMPTYING[index]!}
    </TextMorph>
  );
};

// Both passes at once: two words survive, one splits to characters, one leaves.
export const DEBUG_VALUES = ["npm i torph", "pnpm add torph", "yarn add torph"];

// `debug` is in the config key, so toggling it re-attaches and the value snaps.
export const DebugBoxes = () => {
  const [on, setOn] = React.useState(true);
  const index = useCycle(DEBUG_VALUES.length, 2000);

  return (
    <>
      <div className={`${styles.stage} ${styles.mono}`}>
        <TextMorph debug={on}>{DEBUG_VALUES[index]!}</TextMorph>
      </div>

      <div className={styles.controls}>
        <Button
          type="button"
          aria-pressed={on}
          onClick={() => setOn((value) => !value)}
        >
          {on ? "Boxes on" : "Boxes off"}
        </Button>
      </div>
    </>
  );
};
