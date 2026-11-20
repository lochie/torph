import React from "react";
import { classic, type TorphPlugin } from "torph";
import { mask } from "torph/plugins/mask";
import { TextMorph } from "torph/react";

import styles from "./styles.module.scss";

const Stage = ({
  values,
  plugins,
  duration,
  ease,
  note,
}: {
  values: string[];
  plugins?: readonly TorphPlugin[];
  duration?: number;
  ease?: string;
  note?: string;
}) => {
  const [index, setIndex] = React.useState(0);
  return (
    <button
      type="button"
      className={styles.stage}
      onClick={() => setIndex((i) => (i + 1) % values.length)}
      aria-label="Next value"
    >
      <TextMorph
        className={styles.morph}
        plugins={plugins}
        duration={duration}
        ease={ease}
      >
        {values[index]!}
      </TextMorph>
      {note && <span className={styles.note}>{note}</span>}
    </button>
  );
};

const Demo = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.demo}>
    {children}
    <span className={styles.hint}>Click to change</span>
  </div>
);

export const HelloDemo = () => (
  <Demo>
    <Stage values={["Hello world", "Hello there", "Goodbye world"]} />
  </Demo>
);

export const NumbersDemo = () => (
  <Demo>
    <Stage values={["$1,204.00", "$1,318.50", "$982.10", "$12,040.00"]} />
  </Demo>
);

const SHIP = ["Ship faster", "Ship smarter", "Ship it"];

export const PluginOrderDemo = () => (
  <Demo>
    <Stage
      values={SHIP}
      plugins={[mask(), ...classic()]}
      note="[mask(), ...classic()]"
    />
    <Stage
      values={SHIP}
      plugins={[...classic(), mask()]}
      note="[...classic(), mask()]"
    />
  </Demo>
);

export const EngineAloneDemo = () => (
  <Demo>
    <Stage values={SHIP} note="classic(), the default" />
    <Stage values={SHIP} plugins={[]} note="[]" />
  </Demo>
);

const rise: TorphPlugin = {
  name: "rise",
  animate: {
    text: {
      enter: (box, { delta, duration, ease, animate }) => [
        animate(
          box,
          [
            {
              transform: `translate(${delta.x}px, ${delta.y + 8}px)`,
              opacity: 0,
            },
            { transform: "none", opacity: 1 },
          ],
          { duration, easing: ease, fill: "backwards" },
        ),
      ],
    },
  },
};

export const RiseDemo = () => (
  <Demo>
    <Stage
      values={["Saving", "Saved", "Saved just now"]}
      plugins={[rise, ...classic()]}
    />
  </Demo>
);

/** The same slide, started with `element.animate` or with `ctx.animate`. */
const slide = (resume: boolean): TorphPlugin => ({
  name: resume ? "resumes" : "restarts",
  animate: {
    text: {
      persist: (box, { delta, duration, ease, animate }) => {
        const keyframes = [
          { transform: `translate(${delta.x}px, ${delta.y}px)` },
          { transform: "none" },
        ];
        const options = { duration, easing: ease, fill: "backwards" as const };
        return [
          resume
            ? animate(box, keyframes, options)
            : box.animate(keyframes, options),
        ];
      },
    },
  },
});

const WORLD = ["world", "hello world", "oh hello world", "hello world"];

export const InterruptDemo = () => (
  <Demo>
    <Stage
      values={WORLD}
      duration={1000}
      ease="ease-in-out"
      plugins={[slide(false), ...classic()]}
      note="element.animate"
    />
    <Stage
      values={WORLD}
      duration={1000}
      ease="ease-in-out"
      plugins={[slide(true), ...classic()]}
      note="ctx.animate"
    />
  </Demo>
);
