"use client";

import { Footer } from "@/components/footer";
import styles from "./styles.module.scss";

import { SECTIONS } from "./entries";

export const Examples = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>&lt;TextMorph /&gt;</h1>
          <p>Text continuity for interfaces on the web.</p>
        </div>

        {SECTIONS.map(({ title, demos }) => (
          <section key={title}>
            <h2>{title}</h2>

            <div className={styles.grid}>
              {demos.map(({ label, Component }) => (
                <div key={label} className={styles.example}>
                  <div className={styles.preview}>
                    <Component />
                  </div>
                  <span className={styles.label}>{label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <Footer />
      </div>
    </div>
  );
};
