import React from "react";
import type { TorphPlugin } from "torph";
import { TextMorph } from "torph/react";
import { anagram } from "torph/plugins/anagram";
import { blur } from "torph/plugins/blur";
import { caseless } from "torph/plugins/caseless";
import { flap } from "torph/plugins/flap";
import { redline } from "torph/plugins/redline";
import { reveal } from "torph/plugins/reveal";
import { scramble } from "torph/plugins/scramble";
import { squash } from "torph/plugins/squash";
import { typewriter } from "torph/plugins/typewriter";
import { wave } from "torph/plugins/wave";
import { weight } from "torph/plugins/weight";
import { wipe } from "torph/plugins/wipe";
import { words } from "torph/plugins/words";

import styles from "../styles.module.scss";

const CHOICES: Record<string, () => TorphPlugin[]> = {
  default: () => [],
  blur: () => [blur()],
  scramble: () => [scramble()],
  flap: () => [flap()],
  typewriter: () => [typewriter()],
  wave: () => [wave()],
  wipe: () => [wipe()],
  squash: () => [squash()],
  weight: () => [weight()],
  redline: () => [redline()],
  reveal: () => [reveal()],
  caseless: () => [caseless()],
  anagram: () => [anagram()],
  words: () => [words()],
};

/** Your own text, through whichever plugin is picked. */
export const TryIt = () => {
  const [text, setText] = React.useState("Type here to try a plugin");
  const [choice, setChoice] = React.useState("blur");
  const plugins = React.useMemo(() => CHOICES[choice]!(), [choice]);

  return (
    <div className={styles.try}>
      <div className={styles.compare} data-live="">
        <TextMorph className={styles.morph} plugins={plugins}>
          {text}
        </TextMorph>
      </div>
      <input
        className={styles.tryInput}
        value={text}
        maxLength={48}
        aria-label="Text to morph"
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.choices} role="radiogroup" aria-label="Plugin">
        {Object.keys(CHOICES).map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={name === choice}
            className={styles.choice}
            onClick={() => setChoice(name)}
          >
            {name === "default" ? name : `${name}()`}
          </button>
        ))}
      </div>
    </div>
  );
};
