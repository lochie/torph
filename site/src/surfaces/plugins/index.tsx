"use client";

import React, { type ComponentType } from "react";

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
import { ShowDefault } from "./compare";
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
  /** Too wide for half the grid. */
  wide?: boolean;
}[] = [
  {
    name: "blur",
    summary: "Letters rise into focus and blur away.",
    Demo: BlurDemo,
  },
  { name: "words", summary: "A changed word swaps whole.", Demo: WordsDemo },
  {
    name: "scramble",
    summary: "Letters scramble in and out.",
    Demo: ScrambleDemo,
  },
  {
    name: "flap",
    summary: "Letters flip like a departure board.",
    Demo: FlapDemo,
  },
  {
    name: "typewriter",
    summary: "Backspaces, then types the new text.",
    Demo: TypewriterDemo,
  },
  {
    name: "tokens",
    summary: "Identifiers change at their joins.",
    Demo: TokensDemo,
  },
  {
    name: "odometer",
    summary: "Each wheel turns the way the value went.",
    Demo: () => (
      <>
        <OdometerDemo />
        <CountdownDemo />
      </>
    ),
    wide: true,
  },
  { name: "wave", summary: "Letters drop in with a bounce.", Demo: WaveDemo },
  {
    name: "caseless",
    summary: "A change of case pops in place.",
    Demo: CaselessDemo,
  },
  {
    name: "stack",
    summary: "The whole value slides like a card.",
    Demo: StackDemo,
  },
  { name: "squash", summary: "Stretch, squash and splat.", Demo: SquashDemo },
  {
    name: "countup",
    summary: "Counts through the values between.",
    Demo: CountupDemo,
  },
  {
    name: "rows",
    summary: "Reordered lines slide to their place.",
    Demo: RowsDemo,
  },
  { name: "trend", summary: "Flashes green up, red down.", Demo: TrendDemo },
  {
    name: "reveal",
    summary: "Each place turns over to its new character.",
    Demo: RevealDemo,
  },
  {
    name: "redline",
    summary: "Track changes: struck out, then underlined.",
    Demo: () => (
      <>
        <RedlineDemo />
        <RedlineCodeDemo />
      </>
    ),
    wide: true,
  },
];

const INTRO = `import { classic } from "torph";
import { blur } from "torph/plugins/blur";

<TextMorph plugins={[blur(), ...classic()]}>
  {value}
</TextMorph>`;

const usage = (name: PluginName) =>
  `import { ${name} } from "torph/plugins/${name}";

plugins={[${name}(), ...classic()]}`;

const Card = ({
  name,
  summary,
  Demo,
  wide,
  source,
}: (typeof PLUGINS)[number] & { source: string }) => {
  const [showDefault, setShowDefault] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  return (
    <div
      id={name}
      className={styles.card}
      data-wide={wide || open || undefined}
    >
      <div className={styles.stages}>
        <ShowDefault.Provider value={showDefault}>
          <Demo />
        </ShowDefault.Provider>
      </div>
      <div className={styles.meta}>
        <div className={styles.title}>
          <h2 className={styles.name}>{name}()</h2>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              aria-pressed={showDefault}
              onClick={() => setShowDefault((v) => !v)}
            >
              vs default
            </button>
            <button
              type="button"
              className={styles.action}
              aria-pressed={open}
              aria-label={`${name} source`}
              onClick={() => setOpen((v) => !v)}
            >
              {"</>"}
            </button>
          </div>
        </div>
        <p className={styles.summary}>{summary}</p>
      </div>
      {open && (
        <div className={styles.source}>
          <CodeBlock code={usage(name)} />
          <CodeBlock code={source} />
        </div>
      )}
    </div>
  );
};

export const Plugins = ({
  sources,
}: {
  sources: Record<PluginName, string>;
}) => (
  <div className={styles.page}>
    <div className={styles.container}>
      <Header />
      <section className={styles.intro}>
        <p>
          A plugin changes how torph cuts text up, how it moves, or both. Put
          one in front of classic(), torph&apos;s default set.
        </p>
        <CodeBlock code={INTRO} />
      </section>

      <div className={styles.grid}>
        {PLUGINS.map((plugin) => (
          <Card key={plugin.name} {...plugin} source={sources[plugin.name]} />
        ))}
      </div>

      <section className={styles.mix}>
        <h2 className={styles.heading}>Mix them</h2>
        <p className={styles.summary}>
          Any of them together, on your own text.
        </p>
        <Mix />
      </section>

      <Footer />
    </div>
  </div>
);
