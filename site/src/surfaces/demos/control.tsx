import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { Button } from "@/components/button";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useCycle } from "./use-cycle";

export const SPRING_LABELS = ["Save changes", "Saved", "Save changes to draft"];

export const BEZIER = "cubic-bezier(0.19, 1, 0.22, 1)"; // TextMorph's own default

export const SPRINGS = [
  { name: "gentle", stiffness: 120, damping: 14 },
  { name: "snappy", stiffness: 200, damping: 20 },
  { name: "bouncy", stiffness: 260, damping: 12 },
];

const MORPH_EVERY = 2400; // Longer than the slowest preset takes to settle

export const Spring = () => {
  const [chosen, setChosen] = React.useState(1); // The preset the docs sample uses
  const [index, setIndex] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();
  const { stiffness, damping } = SPRINGS[chosen]!;

  const advance = React.useCallback(
    () => setIndex((i) => (i + 1) % SPRING_LABELS.length),
    [],
  );

  // Restarted on `chosen`, so a preset just picked gets a full window to itself.
  React.useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(advance, MORPH_EVERY);
    return () => window.clearInterval(id);
  }, [advance, chosen, reducedMotion]);

  return (
    <div className={styles.bench}>
      <div className={styles.lanes}>
        <div className={styles.lane}>
          <TextMorph
            className={`${styles.stage} ${styles.stageSmall}`}
            ease={{ stiffness, damping }}
          >
            {SPRING_LABELS[index]!}
          </TextMorph>
          <span className={styles.caption}>spring</span>
        </div>

        <div className={styles.lane}>
          <TextMorph
            className={`${styles.stage} ${styles.stageSmall}`}
            ease={BEZIER}
          >
            {SPRING_LABELS[index]!}
          </TextMorph>
          <span className={styles.caption}>cubic-bezier, 400ms</span>
        </div>
      </div>

      <div className={styles.springPicker}>
        <div className={styles.eases} role="group" aria-label="Spring preset">
          {SPRINGS.map(({ name }, i) => (
            <button
              key={name}
              type="button"
              className={styles.ease}
              aria-pressed={i === chosen}
              onClick={() => {
                if (i !== chosen) trigger("selection");
                setChosen(i);
                advance();
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <TextMorph className={styles.easeParams}>
          {`{ stiffness: ${stiffness}, damping: ${damping} }`}
        </TextMorph>
      </div>
    </div>
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
    <div className={styles.bench}>
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
    </div>
  );
};
