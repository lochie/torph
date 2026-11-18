import React from "react";
import { fade, groups, numbers, scale, type TorphPlugin } from "torph";
import { TextMorph } from "torph/react";
import { blur } from "torph/plugins/blur";
import { caseless } from "torph/plugins/caseless";
import { countup } from "torph/plugins/countup";
import { flap } from "torph/plugins/flap";
import { odometer } from "torph/plugins/odometer";
import { redline } from "torph/plugins/redline";
import { reveal } from "torph/plugins/reveal";
import { rows } from "torph/plugins/rows";
import { scramble } from "torph/plugins/scramble";
import { squash } from "torph/plugins/squash";
import { stack } from "torph/plugins/stack";
import { tokens } from "torph/plugins/tokens";
import { trend } from "torph/plugins/trend";
import { typewriter } from "torph/plugins/typewriter";
import { wave } from "torph/plugins/wave";
import { words } from "torph/plugins/words";

import { CodeBlock } from "@/components/codeblock";
import styles from "../styles.module.scss";
import { hidden } from "./hidden";

// Built once: a morph is matched by its plugins' names and options, so a new list each render is fine.
const CLASSIC: Record<string, TorphPlugin> = {
  numbers: numbers(),
  groups: groups(),
  fade: fade(),
  scale: scale(),
};
const MORE: Record<string, TorphPlugin> = {
  blur: blur(),
  words: words(),
  scramble: scramble(),
  flap: flap(),
  typewriter: typewriter(),
  tokens: tokens(),
  odometer: odometer(),
  wave: wave(),
  caseless: caseless(),
  stack: stack(),
  squash: squash(),
  redline: redline(),
  countup: countup(),
  rows: rows(),
  trend: trend(),
  reveal: reveal(),
};
const BUILT = { ...MORE, ...CLASSIC };

// Pairs that each change something different: words, figures, identifiers, lines.
const EXAMPLES = [
  "Processing transaction",
  "Transaction safe",
  "Total $1,284",
  "Total $2,019.50",
  "getUserName",
  "getUserEmail",
  "Two lines\nof text",
  "Two new lines\nof text",
];

/** The `plugins` line for a selection, written the way the README suggests. */
function usage(picked: string[]) {
  const extras = picked.filter((name) => name in MORE);
  const allClassic = Object.keys(CLASSIC).every((name) =>
    picked.includes(name),
  );
  if (allClassic && extras.length === 0)
    return "<TextMorph>{value}</TextMorph> // classic()";
  const list = allClassic
    ? [...extras.map((name) => `${name}()`), "...classic()"]
    : picked.map((name) => `${name}()`);
  return `<TextMorph plugins={[${list.join(", ")}]}>{value}</TextMorph>`;
}

const Toggle = ({
  name,
  on,
  by,
  flip,
}: {
  name: string;
  on: boolean;
  by?: string[];
  flip: () => void;
}) => {
  const note = by && `hidden by ${by.map((n) => `${n}()`).join(", ")}`;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-description={note}
      title={note}
      className={styles.choice}
      data-hidden={by ? "" : undefined}
      onClick={flip}
    >
      {name}()
    </button>
  );
};

/** Any plugins together, on your own text: starts as torph's default set. */
export const Mix = () => {
  const [example, setExample] = React.useState(0);
  const [text, setText] = React.useState(EXAMPLES[0]!);
  // Newest first: the plugin picked last goes in front, so it's the one you see.
  const [chosen, setChosen] = React.useState<string[]>(() =>
    Object.keys(CLASSIC),
  );
  const picked = [
    ...chosen.filter((name) => name in MORE),
    ...Object.keys(CLASSIC).filter((name) => chosen.includes(name)),
  ];
  const plugins = picked.map((name) => BUILT[name]!);
  const covered = hidden(
    picked.map((name) => [name, BUILT[name]!]),
    text,
  );

  const flip = (name: string) =>
    setChosen((current) =>
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [name, ...current],
    );
  const nextExample = () => {
    const i = (example + 1) % EXAMPLES.length;
    setExample(i);
    setText(EXAMPLES[i]!);
  };

  return (
    <div className={styles.try}>
      <button
        type="button"
        className={styles.stage}
        data-mix=""
        onClick={nextExample}
        aria-label="Next example"
      >
        <TextMorph className={styles.morph} plugins={plugins}>
          {text}
        </TextMorph>
      </button>
      <textarea
        className={styles.tryInput}
        value={text}
        rows={2}
        maxLength={120}
        aria-label="Text to morph"
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.group}>
        <span className={styles.groupName}>classic()</span>
        <div className={styles.choices}>
          {Object.keys(CLASSIC).map((name) => (
            <Toggle
              key={name}
              name={name}
              on={chosen.includes(name)}
              by={covered.get(name)}
              flip={() => flip(name)}
            />
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <span className={styles.groupName}>in front of it</span>
        <div className={styles.choices}>
          {Object.keys(MORE).map((name) => (
            <Toggle
              key={name}
              name={name}
              on={chosen.includes(name)}
              by={covered.get(name)}
              flip={() => flip(name)}
            />
          ))}
        </div>
      </div>
      {covered.size > 0 && (
        <p className={styles.hiddenNote}>
          {[...covered]
            .map(
              ([name, by]) =>
                `${name}() is hidden by ${by.map((n) => `${n}()`).join(", ")}`,
            )
            .join(" · ")}
        </p>
      )}
      <CodeBlock code={usage(picked)} />
    </div>
  );
};
