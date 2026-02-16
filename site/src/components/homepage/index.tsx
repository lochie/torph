import styles from "./styles.module.scss";

import { useState } from "react";

import { TextMorph } from "torph/react";

import { Footer } from "../footer";
import { CodeBlock } from "../codeblock";
import { HighlightedCode } from "../codeblock/highlighted-code";
import { InstallCommands } from "./install-cmd";
import { examples, populateExample } from "./usage";
import * as Logos from "./logos";
import { Examples } from "./examples";
import { Button } from "../button";

const frameworks = [
  {
    name: "React",
    entrypoint: "torph/react",
    logo: <Logos.ReactLogo />,
    example: examples.react,
  },
  {
    name: "TypeScript",
    entrypoint: "torph",
    logo: <Logos.TypeScriptLogo />,
    example: examples.vanilla,
  },
  {
    name: "Vue",
    entrypoint: "torph/vue",
    logo: <Logos.VueLogo />,
    example: examples.vue,
  },
  {
    name: "Svelte",
    entrypoint: "torph/svelte",
    logo: <Logos.SvelteLogo />,
    example: examples.svelte,
  },
];

export default function Home() {
  const text = "Hello world";
  const [frameworkIndex, setFrameworkIndex] = useState(0);
  const framework = frameworks[frameworkIndex % frameworks.length];
  const body = populateExample(framework.example, text);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>&lt;TextMorph /&gt;</h1>
          <p>Dependency-free animated text component.</p>
        </div>

        <Examples />

        <section>
          <h3>Install</h3>
          <InstallCommands />
        </section>

        <section>
          <h3>Usage</h3>

          <div className={styles.example}>
            <div className={styles.controls}>
              {frameworks.map((f, i) => (
                <Button
                  key={f.name}
                  disabled={frameworkIndex === i}
                  onClick={() => setFrameworkIndex(i)}
                  aria-label={`View example for ${f.name}`}
                >
                  <span className={styles.logo}>{f.logo}</span>
                  <span className={styles.name}>{f.name}</span>
                </Button>
              ))}
            </div>

            <CodeBlock code={body}>
              <span style={{ color: "var(--sh-keyword)" }}>import</span>
              <span style={{ color: "var(--sh-sign)" }}>{" { "}</span>
              <span style={{ color: "var(--sh-identifier)" }}>
                TextMorph
              </span>
              <span style={{ color: "var(--sh-sign)" }}>{" } "}</span>
              <span style={{ color: "var(--sh-keyword)" }}>from</span>
              {" "}
              <span style={{ color: "var(--sh-string)" }}>
                {"'"}
                <TextMorph>{framework.entrypoint}</TextMorph>
                {"'"}
              </span>
              <span style={{ color: "var(--sh-sign)" }}>;</span>
              {"\n\n"}
              <HighlightedCode code={body} />
            </CodeBlock>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
