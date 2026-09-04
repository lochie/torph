"use client";

import styles from "./styles.module.scss";

import { useState } from "react";
import { useWebHaptics } from "web-haptics/react";

import { TextMorph } from "torph/react";

import { Footer } from "@/components/footer";
import { CodeBlock } from "@/components/codeblock";
import { InstallCommands } from "./install-cmd";
import { examples, populateExample } from "./usage";
import * as Logos from "./logos";
import { Examples } from "./examples";
import { Button } from "@/components/button";
import { Header } from "@/components/header";

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

export const Homepage = ({ size }: { size?: string }) => {
  const text = "Hello world";
  const [frameworkIndex, setFrameworkIndex] = useState(0);
  const { trigger } = useWebHaptics();

  const codeExample = `import { TextMorph } from '${frameworks[frameworkIndex % frameworks.length].entrypoint}'
               
${populateExample(frameworks[frameworkIndex % frameworks.length].example, text)}`;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header />

        <Examples />

        <section>
          <h2>Install</h2>
          <InstallCommands />
        </section>

        <section>
          <h2>Usage</h2>

          <div className={styles.example}>
            <div className={styles.controls}>
              {frameworks.map((f, i) => (
                <Button
                  key={f.name}
                  type="button"
                  // Not `disabled`: that drops the selected one from the tab order.
                  aria-pressed={frameworkIndex === i}
                  onClick={() => {
                    trigger("selection");
                    setFrameworkIndex(i);
                  }}
                  aria-label={`View example for ${f.name}`}
                >
                  <span className={styles.logo}>{f.logo}</span>
                  <span className={styles.name}>{f.name}</span>
                </Button>
              ))}
            </div>

            <CodeBlock code={codeExample}>
              <TextMorph>{codeExample}</TextMorph>
            </CodeBlock>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
};
