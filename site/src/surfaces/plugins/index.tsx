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
import { OdometerDemo } from "./odometer";
import { WaveDemo } from "./wave";
import { WipeDemo } from "./wipe";
import { CaselessDemo } from "./caseless";
import { AnagramDemo } from "./anagram";
import { StackDemo } from "./stack";
import { SquashDemo } from "./squash";
import { RedlineCodeDemo, RedlineDemo } from "./redline";
import { CountupDemo } from "./countup";
import { SkeletonDemo } from "./skeleton";
import { MagnetDemo } from "./magnet";
import { WeightDemo } from "./weight";
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
  | "wipe"
  | "caseless"
  | "anagram"
  | "stack"
  | "squash"
  | "redline"
  | "countup"
  | "skeleton"
  | "magnet"
  | "weight";

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
    Demo: OdometerDemo,
  },
  {
    name: "wave",
    summary:
      "Letter by letter, text drops in with a bounce and falls away under its own weight.",
    Demo: WaveDemo,
  },
  {
    name: "wipe",
    summary:
      "An edge crosses the value, wiping the old text away and revealing the new.",
    Demo: WipeDemo,
  },
  {
    name: "caseless",
    summary:
      "A letter that only changes case keeps its box, and pops to the new one in place.",
    Demo: CaselessDemo,
  },
  {
    name: "anagram",
    summary:
      "Every letter is reused wherever the new value needs it, across words and in any order.",
    Demo: AnagramDemo,
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
      "Moving text stretches along its path, then squashes as it lands, like rubber.",
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
    name: "skeleton",
    summary:
      "While the value is empty a shimmering bar holds its place, and the text fades in over it.",
    Demo: SkeletonDemo,
  },
  {
    name: "magnet",
    summary:
      "Letters near the pointer lean away from it, and settle back when it leaves.",
    Demo: MagnetDemo,
  },
  {
    name: "weight",
    summary:
      "Letter by letter, new text arrives heavy and relaxes to its weight; leaving text thins away.",
    Demo: WeightDemo,
  },
];

const usage = (name: PluginName) =>
  `import { ${name} } from "torph/plugins/${name}";

<TextMorph plugins={[${name}()]}>{value}</TextMorph>`;

export const Plugins = ({
  sources,
}: {
  sources: Record<PluginName, string>;
}) => (
  <div className={styles.page}>
    <div className={styles.container}>
      <Header />
      <p className={styles.intro}>
        A plugin changes how torph cuts text up, how it moves, or both. Numbers
        and grouped replacements are plugins too, on by default. Each one below
        is its whole source.
      </p>

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
