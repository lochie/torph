"use client";

import { Footer } from "@/components/footer";
import styles from "./styles.module.scss";

import { SECTIONS } from "./entries";
import { LazyDemo } from "./lazy-demo";
import { Header } from "@/components/header";

export const Examples = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header />
      </div>

      {SECTIONS.map(({ title, demos }) => (
        <section key={title} className={styles.section}>
          <h2>{title}</h2>

          <div className={styles.grid}>
            {demos.map(({ label, Component }) => (
              <div key={label} className={styles.example}>
                <LazyDemo Component={Component} />
                <span className={styles.label}>{label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className={styles.container}>
        <Footer />
      </div>
    </div>
  );
};
