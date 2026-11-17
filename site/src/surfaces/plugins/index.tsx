"use client";

import type { ComponentType } from "react";

import { CodeBlock } from "@/components/codeblock";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { BlurDemo } from "./blur";
import { ScrambleDemo } from "./scramble";
import { WordsDemo } from "./words";
import { FlapDemo } from "./flap";
import { TypewriterDemo } from "./typewriter";
import { TokensDemo } from "./tokens";
import { CountdownDemo, OdometerDemo } from "./odometer";
import { WaveDemo } from "./wave";
import { CaselessDemo } from "./caseless";
import { StackDemo } from "./stack";
import { SquashDemo } from "./squash";
import { RedlineCodeDemo, RedlineDemo } from "./redline";
import { CountupDemo } from "./countup";
import { RowsDemo } from "./rows";
import { TrendDemo } from "./trend";
import { RevealDemo } from "./reveal";
import { Mix } from "./mix";
import styles from "./styles.module.scss";

export type PluginName =
  | "blur"
  | "words"
  | "scramble"
  | "flap"
  | "typewriter"
  | "tokens"
  | "odometer"
  | "wave"
  | "caseless"
  | "stack"
  | "squash"
  | "redline"
  | "countup"
  | "rows"
  | "trend"
  | "reveal";

const PLUGINS: {
  name: PluginName;
  summary: string;
  Demo: ComponentType;
}[] = [
  {
    name: "blur",
    summary: "Letter by letter, text rises into focus and blurs away upwards.",
    Demo: BlurDemo,
  },
  {
    name: "words",
    summary:
      "A changed word swaps whole, instead of morphing the letters it shares.",
    Demo: WordsDemo,
  },
  {
    name: "scramble",
    summary:
      "Letter by letter, arriving text scrambles into place and leaving text scrambles away.",
    Demo: ScrambleDemo,
  },
  {
    name: "flap",
    summary:
      "Like a departure board, each changing letter flips round to the new one.",
    Demo: FlapDemo,
  },
  {
    name: "typewriter",
    summary:
      "Old text backspaces from the end, then the new text types in, caret and all.",
    Demo: TypewriterDemo,
  },
  {
    name: "tokens",
    summary:
      "Identifiers and paths change at their joins, so the parts that stay put stay put.",
    Demo: TokensDemo,
  },
  {
    name: "odometer",
    summary:
      "Figures count like a car's odometer, every wheel turning the way the value went.",
    Demo: () => (
      <>
        <OdometerDemo />
        <CountdownDemo />
      </>
    ),
  },
  {
    name: "wave",
    summary:
      "Letter by letter, text drops in with a bounce and falls away under its own weight.",
    Demo: WaveDemo,
  },
  {
    name: "caseless",
    summary:
      "A letter that only changes case keeps its box, and pops to the new one in place.",
    Demo: CaselessDemo,
  },
  {
    name: "stack",
    summary:
      "The whole value is one card: the old one slides up and away as the new one rises in.",
    Demo: StackDemo,
  },
  {
    name: "squash",
    summary:
      "Like a cartoon: moving text winds up, stretches and lands with a squash and a wobble; new text drops in and splats.",
    Demo: SquashDemo,
  },
  {
    name: "redline",
    summary:
      "Like track changes: removed words stay struck through before they go, added words come underlined.",
    Demo: () => (
      <>
        <RedlineDemo />
        <RedlineCodeDemo />
      </>
    ),
  },
  {
    name: "countup",
    summary:
      "A figure counts through the values between, quick at first and slowing as it arrives.",
    Demo: CountupDemo,
  },
  {
    name: "rows",
    summary:
      "Each line is one box, known by its key, so a reordered list slides every row to its new place.",
    Demo: RowsDemo,
  },
  {
    name: "trend",
    summary:
      "What changes in a figure flashes green as it rises and red as it falls, then fades back.",
    Demo: TrendDemo,
  },
  {
    name: "reveal",
    summary:
      "Each place keeps its box and turns over to its new character, like a masked value revealed.",
    Demo: RevealDemo,
  },
];

const usage = (name: PluginName) =>
  `import { classic } from "torph";
import { ${name} } from "torph/plugins/${name}";

<TextMorph plugins={[${name}(), ...classic()]}>{value}</TextMorph>`;

export const Plugins = ({
  sources,
}: {
  sources: Record<PluginName, string>;
}) => (
  <div className={styles.page}>
    <div className={styles.container}>
      <Header />
      <p className={styles.intro}>
        A plugin changes how torph cuts text up, how it moves, or both.
        torph&apos;s own look is a set of plugins too, classic(), and each one
        below is added in front of it. Each is its whole source.
      </p>

      <section className={styles.plugin}>
        <h2 className={styles.name}>mix them</h2>
        <p className={styles.summary}>
          torph&apos;s default set, classic(), is ticked. Add any of the others
          in front of it, take parts of it away, or type your own text.
        </p>
        <Mix />
      </section>

      {PLUGINS.map(({ name, summary, Demo }) => (
        <section key={name} className={styles.plugin}>
          <h2 className={styles.name}>{name}</h2>
          <p className={styles.summary}>{summary}</p>
          <Demo />
          <CodeBlock code={usage(name)} />
          <CodeBlock code={sources[name]} />
        </section>
      ))}

      <Footer />
    </div>
  </div>
);
