"use client";

import { Footer } from "@/components/footer";
import styles from "./styles.module.scss";

import { DEMOS } from "./entries";
import { LazyDemo } from "./lazy-demo";
import { Header } from "@/components/header";

export const Examples = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header />
      </div>

      <section className={styles.demos}>
        {DEMOS.map(({ label, Component }, index) => (
          <div key={index} className={styles.example}>
            <LazyDemo Component={Component} />
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </section>

      <div className={styles.container}>
        <Footer />
      </div>
    </div>
  );
};
