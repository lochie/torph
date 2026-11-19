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
import { SmokeDemo } from "./smoke";
import { GlitchDemo } from "./glitch";
import { NeonDemo } from "./neon";
import { ShatterDemo } from "./shatter";
import { StampDemo } from "./stamp";
import { RollDemo } from "./roll";
import { LookalikeDemo } from "./lookalike";
import { MaskDemo } from "./mask";
import { FadeUpDemo } from "./fadeUp";
import { CascadeDemo } from "./cascade";
import { TickerDemo } from "./ticker";
import { FadeThroughDemo } from "./fadeThrough";
import { SharedAxisDemo } from "./sharedAxis";
import { SlotDemo } from "./slot";
import { DissolveDemo } from "./dissolve";
import { RippleDemo } from "./ripple";
import { Mix } from "./mix";
import { ShowDefault } from "./compare";
import { GROUPS, type PluginName } from "./catalog";
import styles from "./styles.module.scss";

/** Each plugin's demo; a missing one is a type error. `wide` is too wide for half the grid. */
const DEMOS: Record<PluginName, { Demo: ComponentType; wide?: boolean }> = {
  mask: { Demo: MaskDemo, wide: true },
  fadeUp: { Demo: FadeUpDemo },
  cascade: { Demo: CascadeDemo },
  ticker: { Demo: TickerDemo },
  fadeThrough: { Demo: FadeThroughDemo },
  sharedAxis: { Demo: SharedAxisDemo },
  blur: { Demo: BlurDemo },
  words: { Demo: WordsDemo },
  odometer: {
    Demo: () => (
      <>
        <OdometerDemo />
        <CountdownDemo />
      </>
    ),
    wide: true,
  },
  countup: { Demo: CountupDemo },
  trend: { Demo: TrendDemo },
  roll: { Demo: RollDemo },
  slot: { Demo: SlotDemo },
  reveal: { Demo: RevealDemo },
  flap: { Demo: FlapDemo },
  redline: {
    Demo: () => (
      <>
        <RedlineDemo />
        <RedlineCodeDemo />
      </>
    ),
    wide: true,
  },
  rows: { Demo: RowsDemo },
  tokens: { Demo: TokensDemo },
  caseless: { Demo: CaselessDemo },
  typewriter: { Demo: TypewriterDemo },
  squash: { Demo: SquashDemo },
  wave: { Demo: WaveDemo },
  stamp: { Demo: StampDemo },
  stack: { Demo: StackDemo },
  scramble: { Demo: ScrambleDemo },
  lookalike: { Demo: LookalikeDemo },
  smoke: { Demo: SmokeDemo },
  glitch: { Demo: GlitchDemo },
  neon: { Demo: NeonDemo },
  shatter: { Demo: ShatterDemo },
  dissolve: { Demo: DissolveDemo },
  ripple: { Demo: RippleDemo },
};

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
}: {
  name: PluginName;
  summary: string;
  Demo: ComponentType;
  wide?: boolean;
  source: string;
}) => {
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

      <nav className={styles.index} aria-label="Plugins">
        {GROUPS.map((group) => (
          <div key={group.id} className={styles.indexGroup}>
            <a href={`#${group.id}`} className={styles.indexTitle}>
              {group.title}
            </a>
            <div className={styles.indexNames}>
              {group.plugins.map(({ name }) => (
                <a key={name} href={`#${name}`} className={styles.indexName}>
                  {name}
                </a>
              ))}
            </div>
          </div>
        ))}
        <div className={styles.indexGroup}>
          <a href="#mix" className={styles.indexTitle}>
            Mix them
          </a>
        </div>
      </nav>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.heading}>{group.title}</h2>
            <p className={styles.summary}>{group.summary}</p>
          </div>
          <div className={styles.grid}>
            {group.plugins.map((plugin) => (
              <Card
                key={plugin.name}
                {...plugin}
                {...DEMOS[plugin.name]}
                source={sources[plugin.name]}
              />
            ))}
          </div>
        </section>
      ))}

      <section id="mix" className={styles.mix}>
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
