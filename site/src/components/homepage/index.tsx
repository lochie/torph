import styles from "./styles.module.scss";

import { useState } from "react";

import { TextMorph } from "torph/react";

import { Footer } from "../footer";
import { Dropdown } from "../dropdown";
import { CodeBlock } from "../codeblock";
import { InstallCommands } from "./install-cmd";
import { examples, populateExample } from "./usage";
import * as Logos from "./logos";
import { Examples } from "./examples";

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
  const [frameworkIndex, setFrameworkIndex] = useState(0);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>
            <span>
              <strong>Text Morph</strong> for
            </span>

            <Dropdown
              options={frameworks.map((f, i) => ({
                label: f.name,
                icon: f.logo,
                disabled: frameworkIndex === i,
                onClick: () => setFrameworkIndex(i),
              }))}
            >
              <div className={styles.framework}>
                {frameworks[frameworkIndex % frameworks.length].logo}

                <strong>
                  <TextMorph>
                    {frameworks[frameworkIndex % frameworks.length].name}
                  </TextMorph>
                </strong>
              </div>
            </Dropdown>
          </h1>
          <p>Dependency-free animated text component.</p>
        </div>

        <Examples />

        <InstallCommands />

        <div className={styles.example}>
          <CodeBlock
            code={populateExample(
              frameworks[frameworkIndex % frameworks.length].example,
              "yo",
            )}
          >
            <TextMorph>
              {`import { TextMorph } from '${frameworks[frameworkIndex % frameworks.length].entrypoint}';`}
            </TextMorph>
            {`
            
${populateExample(frameworks[frameworkIndex % frameworks.length].example, "yo")}`}
          </CodeBlock>
        </div>

        <Footer />
      </div>
    </div>
  );
}
