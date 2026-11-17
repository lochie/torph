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

// In the order they're applied: torph's own set last, so anything picked above it overrides it.
const CLASSIC: Record<string, () => TorphPlugin> = {
  numbers,
  groups,
  fade,
  scale,
};
const MORE: Record<string, () => TorphPlugin> = {
  blur: () => blur(),
  words: () => words(),
  scramble: () => scramble(),
  flap: () => flap(),
  typewriter: () => typewriter(),
  tokens: () => tokens(),
  odometer: () => odometer(),
  wave: () => wave(),
  caseless: () => caseless(),
  stack: () => stack(),
  squash: () => squash(),
  redline: () => redline(),
  countup: () => countup(),
  rows: () => rows(),
  trend: () => trend(),
  reveal: () => reveal(),
};
const ORDER = [...Object.keys(MORE), ...Object.keys(CLASSIC)];
// Built once: a morph is matched by its plugins' names and options, so a new list each render is fine.
const BUILT = Object.fromEntries(
  Object.entries({ ...MORE, ...CLASSIC }).map(([name, make]) => [name, make()]),
);

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
  flip,
}: {
  name: string;
  on: boolean;
  flip: () => void;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    className={styles.choice}
    onClick={flip}
  >
    {name}()
  </button>
);

/** Any plugins together, on your own text: starts as torph's default set. */
export const Mix = () => {
  const [example, setExample] = React.useState(0);
  const [text, setText] = React.useState(EXAMPLES[0]!);
  const [chosen, setChosen] = React.useState<Set<string>>(
    () => new Set(Object.keys(CLASSIC)),
  );
  const picked = ORDER.filter((name) => chosen.has(name));
  const plugins = picked.map((name) => BUILT[name]!);

  const flip = (name: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const nextExample = () => {
    const i = (example + 1) % EXAMPLES.length;
    setExample(i);
    setText(EXAMPLES[i]!);
  };

  return (
    <div className={styles.try}>
      <button
        type="button"
        className={styles.compare}
        onClick={nextExample}
        aria-label="Next example"
      >
        <TextMorph className={styles.morph} plugins={plugins}>
          {text}
        </TextMorph>
        <span className={styles.hint} aria-hidden>
          Click for the next example
        </span>
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
              on={chosen.has(name)}
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
              on={chosen.has(name)}
              flip={() => flip(name)}
            />
          ))}
        </div>
      </div>
      <CodeBlock code={usage(picked)} />
    </div>
  );
};
