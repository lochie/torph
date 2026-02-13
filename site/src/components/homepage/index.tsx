import styles from "./styles.module.scss";

import { useState } from "react";

import { TextMorph } from "torph/react";

import { Footer } from "../footer";
import { CodeBlock } from "../codeblock";
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
                >
                  {f.logo}
                  {f.name}
                </Button>
              ))}
            </div>

            <CodeBlock
              code={populateExample(
                frameworks[frameworkIndex % frameworks.length].example,
                text,
              )}
            >
              <TextMorph>
                {`import { TextMorph } from '${frameworks[frameworkIndex % frameworks.length].entrypoint}';`}
              </TextMorph>
              {`
            
${populateExample(frameworks[frameworkIndex % frameworks.length].example, text)}`}
            </CodeBlock>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
