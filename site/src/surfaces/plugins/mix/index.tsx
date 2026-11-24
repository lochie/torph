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
import { sharedAxis } from "torph/plugins/sharedAxis";
import { fadeThrough } from "torph/plugins/fadeThrough";
import { ticker } from "torph/plugins/ticker";
import { cascade } from "torph/plugins/cascade";
import { fadeUp } from "torph/plugins/fadeUp";
import { mask } from "torph/plugins/mask";
import { lookalike } from "torph/plugins/lookalike";
import { roll } from "torph/plugins/roll";
import { stamp } from "torph/plugins/stamp";
import { shatter } from "torph/plugins/shatter";
import { smoke } from "torph/plugins/smoke";
import { glitch } from "torph/plugins/glitch";
import { neon } from "torph/plugins/neon";
import { slot } from "torph/plugins/slot";
import { dissolve } from "torph/plugins/dissolve";
import { ripple } from "torph/plugins/ripple";

import { CodeBlock } from "@/components/codeblock";
import styles from "../styles.module.scss";
import { overrides, type Override } from "./overrides";

// Built once: a morph is matched by its plugins' names and options, so a new list each render is fine.
const CLASSIC: Record<string, TorphPlugin> = {
  numbers: numbers(),
  groups: groups(),
  fade: fade(),
  scale: scale(),
};
// Grouped by what each mostly decides: plugins in one group compete, plugins across groups stack.
const MOTION: Record<string, TorphPlugin> = {
  blur: blur(),
  wave: wave(),
  squash: squash(),
  scramble: scramble(),
  typewriter: typewriter(),
  flap: flap(),
  reveal: reveal(),
  slot: slot(),
  dissolve: dissolve(),
  ripple: ripple(),
  smoke: smoke(),
  glitch: glitch(),
  neon: neon(),
  shatter: shatter(),
  stamp: stamp(),
  lookalike: lookalike(),
  mask: mask(),
  fadeUp: fadeUp(),
  cascade: cascade(),
  ticker: ticker(),
  fadeThrough: fadeThrough(),
  sharedAxis: sharedAxis(),
};
const SPLITTING: Record<string, TorphPlugin> = {
  words: words(),
  tokens: tokens(),
  caseless: caseless(),
  rows: rows(),
  stack: stack(),
  redline: redline(),
  roll: roll(),
};
const FIGURES: Record<string, TorphPlugin> = {
  countup: countup(),
  odometer: odometer(),
  trend: trend(),
};
// Decorations: they run beside whatever moves the text, so they stack with anything.
const EXTRAS: Record<string, TorphPlugin> = {};
const MORE = { ...MOTION, ...SPLITTING, ...FIGURES, ...EXTRAS };
const GROUPS = [
  { name: "classic()", plugins: CLASSIC },
  { name: "how text moves", plugins: MOTION },
  { name: "how text splits", plugins: SPLITTING },
  { name: "for numbers", plugins: FIGURES },
  { name: "on top of any", plugins: EXTRAS },
];
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

const names = (list: string[]) => list.map((n) => `${n}()`).join(", ");

/** One line on what the plugins in front took from this one. */
function describe(name: string, { by, left }: Override) {
  return left.length === 0
    ? `${name}() is hidden by ${names(by)}`
    : `${name}() is partly overridden by ${names(by)}; its ${left.join(", ")} still apply`;
}

const Toggle = ({
  name,
  on,
  override,
  flip,
}: {
  name: string;
  on: boolean;
  override?: Override;
  flip: () => void;
}) => {
  const note = override && describe(name, override);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      title={note}
      className={styles.choice}
      data-overridden={
        override && (override.left.length === 0 ? "hidden" : "partly")
      }
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
  const overridden = overrides(
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
      {GROUPS.map((group) => (
        <div key={group.name} className={styles.group}>
          <span className={styles.groupName}>{group.name}</span>
          <div className={styles.choices}>
            {Object.keys(group.plugins).map((name) => (
              <Toggle
                key={name}
                name={name}
                on={chosen.includes(name)}
                override={overridden.get(name)}
                flip={() => flip(name)}
              />
            ))}
          </div>
        </div>
      ))}
      {overridden.size > 0 && (
        <ul className={styles.overrides}>
          {[...overridden].map(([name, override]) => (
            <li key={name}>{describe(name, override)}</li>
          ))}
        </ul>
      )}
      <CodeBlock code={usage(picked)} />
    </div>
  );
};
