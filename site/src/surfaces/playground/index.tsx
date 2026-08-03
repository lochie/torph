"use client";

import React from "react";
import styles from "./styles.module.scss";
import pkg from "../../../../packages/torph/package.json";
import { TESTS } from "./tests";
import type { Speed, EasingKey, Align } from "./config";
import { SPEEDS, EASINGS, ALIGNS } from "./config";
import { TestDetail } from "./test-detail";
import { SandboxCard } from "./sandbox-card";
import type { Result } from "@torph/test-cases";

const SANDBOX = -1;

type BundleSize = {
  name: string;
  gzip: number;
  publishedGzip: number | null;
};

export const Playground = ({
  bundleSizes = [],
}: {
  bundleSizes?: BundleSize[];
}) => {
  const [selected, setSelected] = React.useState(0);
  const [filter, setFilter] = React.useState("");
  const [speed, setSpeed] = React.useState<Speed>("default");
  const [easing, setEasing] = React.useState<EasingKey>("default");
  const [align, setAlign] = React.useState<Align>("left");
  const [debug, setDebug] = React.useState(false);

  const [results, setResults] = React.useState<(Result | null)[]>(() =>
    TESTS.map(() => null),
  );
  React.useEffect(() => {
    setResults(TESTS.map((t) => t.verify()));
  }, []);

  const query = filter.trim().toLowerCase();
  const visible = TESTS.map((_, i) => i).filter((i) => {
    if (!query) return true;
    const t = TESTS[i]!;
    return (
      t.label.toLowerCase().includes(query) ||
      t.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const failing = results.filter((r) => r && !r.pass).length;
  const ran = results.filter(Boolean).length;
  const current = selected >= 0 ? TESTS[selected] : null;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.count}>
            {failing > 0 ? (
              <span className={styles.fail}>{failing} failing</span>
            ) : (
              `${ran} passing`
            )}
          </span>
          <span className={styles.version}>v{pkg.version}</span>
        </div>

        <input
          className={styles.search}
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <nav className={styles.list}>
          <button
            type="button"
            className={`${styles.listItem} ${
              selected === SANDBOX ? styles.listItemActive : ""
            }`}
            onClick={() => setSelected(SANDBOX)}
          >
            <span className={styles.dotIdle} />
            <span className={styles.listLabel}>Sandbox</span>
          </button>

          {visible.map((i) => {
            const r = results[i];
            return (
              <button
                key={TESTS[i]!.label}
                type="button"
                className={`${styles.listItem} ${
                  selected === i ? styles.listItemActive : ""
                }`}
                onClick={() => setSelected(i)}
              >
                <span
                  className={
                    !r
                      ? styles.dotIdle
                      : r.pass
                        ? styles.dotPass
                        : styles.dotFail
                  }
                />
                <span className={styles.listLabel}>{TESTS[i]!.label}</span>
              </button>
            );
          })}

          {visible.length === 0 && (
            <p className={styles.empty}>No cases match “{filter}”.</p>
          )}
        </nav>

        {bundleSizes.length > 0 && (
          <div className={styles.bundles}>
            {bundleSizes.map((b) => {
              const diff =
                b.publishedGzip === null ? null : b.gzip - b.publishedGzip;
              const published =
                b.publishedGzip === null
                  ? "published size unavailable"
                  : `${(b.publishedGzip / 1024).toFixed(2)}kB gz published`;
              return (
                <span
                  key={b.name}
                  title={`${b.name}: ${(b.gzip / 1024).toFixed(
                    2,
                  )}kB gz local vs ${published}`}
                >
                  {b.name} <strong>{(b.gzip / 1024).toFixed(1)}kB</strong>
                  {diff !== null && diff !== 0 && (
                    <em className={diff > 0 ? styles.up : styles.down}>
                      {diff > 0 ? "+" : ""}
                      {diff}B
                    </em>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </aside>

      <main className={styles.main}>
        <div className={styles.controls}>
          <div className={styles.group}>
            {(Object.keys(SPEEDS) as Speed[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.btn} ${speed === s ? styles.btnActive : ""}`}
                onClick={() => setSpeed(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.group}>
            {(Object.keys(EASINGS) as EasingKey[]).map((e) => (
              <button
                key={e}
                type="button"
                className={`${styles.btn} ${easing === e ? styles.btnActive : ""}`}
                onClick={() => setEasing(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className={styles.group}>
            {ALIGNS.map((a) => (
              <button
                key={a}
                type="button"
                className={`${styles.btn} ${align === a ? styles.btnActive : ""}`}
                onClick={() => setAlign(a)}
                title={`Align ${a}`}
              >
                {a[0]!.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.btn} ${debug ? styles.btnActive : ""}`}
            onClick={() => setDebug((d) => !d)}
          >
            debug
          </button>
        </div>

        {current ? (
          <TestDetail
            key={current.label}
            test={current}
            result={results[selected] ?? null}
            speed={speed}
            easing={easing}
            align={align}
            debug={debug}
            onTagClick={(tag) => setFilter(tag)}
          />
        ) : (
          <SandboxCard
            speed={speed}
            easing={easing}
            align={align}
            debug={debug}
          />
        )}

        <p className={styles.hint}>
          <kbd>Space</kbd> morph · cases live in{" "}
          <code>packages/test-cases/src/cases.ts</code>
        </p>
      </main>
    </div>
  );
};
