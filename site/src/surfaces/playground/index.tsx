"use client";

import React from "react";
import styles from "./styles.module.scss";
import pkg from "../../../../packages/torph/package.json";
import { TESTS } from "./tests";
import { NUMBER_TESTS } from "./number-tests";
import type { Speed, EasingKey, Align, Locale, DecimalsKey } from "./config";
import { SPEEDS, EASINGS, ALIGNS, LOCALES, DECIMALS } from "./config";
import { TestDetail } from "./test-detail";
import { SandboxCard } from "./sandbox-card";
import { NumberDetail } from "./number-detail";
import { NumberSandbox } from "./number-sandbox";
import { ChartPlayground } from "./chart-demo";
import { InputPlayground } from "./input-demo";
import { TickerDemo } from "./ticker-demo";
import type { Result } from "@torph/test-cases";

// Negative ids sit outside the corpus — they select a panel, not a case.
const SANDBOX = -1;
const CHART_DEMO = -2;
const INPUT_DEMO = -3;
const TICKER_DEMO = -4;

const MODES = ["text", "numbers"] as const;
type Mode = (typeof MODES)[number];

// Scoped per mode: the chart and input demos drive numeric morphs, so they have
// nothing to show under text. The mode switch already says "numbers", so the
// labels don't repeat it.
const PANELS: Record<Mode, { id: number; label: string }[]> = {
  text: [{ id: SANDBOX, label: "Sandbox" }],
  numbers: [
    { id: SANDBOX, label: "Sandbox" },
    { id: TICKER_DEMO, label: "Ticker" },
    { id: CHART_DEMO, label: "Chart" },
    { id: INPUT_DEMO, label: "Input" },
  ],
};

// The chart and input demos style their own numbers, so the shared duration,
// easing and alignment controls would sit there doing nothing. The ticker runs
// on them — its whole point is the interval measured against the duration.
const SELF_STYLED: number[] = [CHART_DEMO, INPUT_DEMO];
const DEMOS: number[] = [CHART_DEMO, INPUT_DEMO, TICKER_DEMO];

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
  const [mode, setMode] = React.useState<Mode>("text");
  // Kept per mode so switching back lands on the case you left.
  const [selection, setSelection] = React.useState<Record<Mode, number>>({
    text: 0,
    numbers: 0,
  });
  const [filter, setFilter] = React.useState("");
  const [speed, setSpeed] = React.useState<Speed>("default");
  const [easing, setEasing] = React.useState<EasingKey>("default");
  const [align, setAlign] = React.useState<Align>("left");
  const [debug, setDebug] = React.useState(false);
  const [locale, setLocale] = React.useState<Locale>("en");
  const [decimals, setDecimals] = React.useState<DecimalsKey>("auto");
  const [tabular, setTabular] = React.useState(false);

  const cases = mode === "text" ? TESTS : NUMBER_TESTS;
  const selected = selection[mode]!;
  const select = (index: number) =>
    setSelection((s) => ({ ...s, [mode]: index }));

  const [results, setResults] = React.useState<Record<Mode, (Result | null)[]>>(
    () => ({
      text: TESTS.map(() => null),
      numbers: NUMBER_TESTS.map(() => null),
    }),
  );
  React.useEffect(() => {
    setResults({
      text: TESTS.map((t) => t.verify()),
      numbers: NUMBER_TESTS.map((t) => t.verify()),
    });
  }, []);

  const modeResults = results[mode]!;

  const query = filter.trim().toLowerCase();
  const visible = cases
    .map((_, i) => i)
    .filter((i) => {
      if (!query) return true;
      const t = cases[i]!;
      return (
        t.label.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

  const failing = modeResults.filter((r) => r && !r.pass).length;
  const ran = modeResults.filter(Boolean).length;
  const current = selected >= 0 ? cases[selected] : null;

  const isSelfStyled = SELF_STYLED.includes(selected);
  const isDemo = DEMOS.includes(selected);

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

        <div className={styles.group}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.btn} ${styles.modeBtn} ${
                mode === m ? styles.btnActive : ""
              }`}
              onClick={() => {
                setMode(m);
                setFilter("");
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          className={styles.search}
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <nav className={styles.list}>
          {PANELS[mode].map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`${styles.listItem} ${
                selected === panel.id ? styles.listItemActive : ""
              }`}
              onClick={() => select(panel.id)}
            >
              <span className={styles.dotIdle} />
              <span className={styles.listLabel}>{panel.label}</span>
            </button>
          ))}

          {visible.map((i) => {
            const r = modeResults[i];
            return (
              <button
                key={cases[i]!.label}
                type="button"
                className={`${styles.listItem} ${
                  selected === i ? styles.listItemActive : ""
                }`}
                onClick={() => select(i)}
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
                <span className={styles.listLabel}>{cases[i]!.label}</span>
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
        {!isSelfStyled && (
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
            {mode === "text" ? (
              <button
                type="button"
                className={`${styles.btn} ${debug ? styles.btnActive : ""}`}
                onClick={() => setDebug((d) => !d)}
              >
                debug
              </button>
            ) : (
              <>
                <div className={styles.group}>
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`${styles.btn} ${locale === l ? styles.btnActive : ""}`}
                      onClick={() => setLocale(l)}
                      title={`Format with ${l}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className={styles.group}>
                  {(Object.keys(DECIMALS) as DecimalsKey[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.btn} ${decimals === d ? styles.btnActive : ""}`}
                      onClick={() => setDecimals(d)}
                      title={
                        d === "auto"
                          ? "Let the locale decide"
                          : `Format to ${d} decimal places`
                      }
                    >
                      {d === "auto" ? "auto" : `.${d}`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${tabular ? styles.btnActive : ""}`}
                  onClick={() => setTabular((t) => !t)}
                  title="Render with font-variant-numeric: tabular-nums — every digit gets the same advance width, so a same-length morph should be perfectly still"
                >
                  tabular
                </button>
              </>
            )}
          </div>
        )}

        {mode === "text" ? (
          current ? (
            <TestDetail
              key={current.label}
              test={current as (typeof TESTS)[number]}
              result={modeResults[selected] ?? null}
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
          )
        ) : current ? (
          <NumberDetail
            key={current.label}
            test={current as (typeof NUMBER_TESTS)[number]}
            result={modeResults[selected] ?? null}
            speed={speed}
            easing={easing}
            align={align}
            locale={locale}
            decimals={decimals}
            tabular={tabular}
            onTagClick={(tag) => setFilter(tag)}
          />
        ) : selected === CHART_DEMO ? (
          <ChartPlayground />
        ) : selected === INPUT_DEMO ? (
          <InputPlayground />
        ) : selected === TICKER_DEMO ? (
          <TickerDemo
            speed={speed}
            easing={easing}
            align={align}
            locale={locale}
            decimals={decimals}
            tabular={tabular}
          />
        ) : (
          <NumberSandbox
            speed={speed}
            easing={easing}
            align={align}
            locale={locale}
            decimals={decimals}
            tabular={tabular}
          />
        )}

        {!isDemo && (
          <p className={styles.hint}>
            <kbd>Space</kbd> morph · cases live in{" "}
            <code>
              packages/test-cases/src/
              {mode === "text" ? "cases.ts" : "number-cases.ts"}
            </code>
          </p>
        )}
      </main>
    </div>
  );
};
