import React from "react";
import { TextMorph } from "torph/react";
import { decimalSeparator } from "torph";
import styles from "./styles.module.scss";
import { formatValue } from "./number-tests";
import type { NumberBenchCase } from "./number-tests";
import { buildNumberIssueReport, copyText } from "./issue";
import { SPEEDS, EASINGS, DECIMALS } from "./config";
import type { Speed, EasingKey, Align, Locale, DecimalsKey } from "./config";
import type { Result } from "@torph/test-cases";
import { AlignmentInspector } from "./alignment-inspector";
import type { JumpSnapshot, PerfResult } from "./verify-dom";
import {
  FrameMonitor,
  takeJumpSnapshot,
  verifyDomStandard,
  verifyNoJump,
  verifyTabularDigits,
} from "./verify-dom";
import { combineResults } from "@torph/test-cases";

export function NumberDetail({
  test,
  result,
  speed,
  easing,
  align: globalAlign,
  locale: globalLocale,
  decimals: globalDecimals,
  tabular: globalTabular,
  onTagClick,
}: {
  test: NumberBenchCase;
  result: Result | null;
  speed: Speed;
  easing: EasingKey;
  align: Align;
  locale: Locale;
  decimals: DecimalsKey;
  tabular: boolean;
  onTagClick?: (tag: string) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [showInspector, setShowInspector] = React.useState(false);
  const [showChecks, setShowChecks] = React.useState(false);
  const [useCursors, setUseCursors] = React.useState(true);
  const [auto, setAuto] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  // A case that pins a locale or a decimal count is testing that setting, so it
  // wins over the toolbar the same way `test.align` does.
  const align = test.align ?? globalAlign;
  const locale = test.locale ?? globalLocale;
  const decimals = test.decimals ?? DECIMALS[globalDecimals];
  const decimalChar = decimalSeparator(locale);
  // A case that opts into tabular figures is testing them, so it cannot be
  // switched off from the toolbar — but any case can be switched on.
  const tabular = test.tabular || globalTabular;

  const [dom, setDom] = React.useState<Result | null>(null);
  const [jump, setJump] = React.useState<Result | null>(null);
  const [perf, setPerf] = React.useState<PerfResult | null>(null);

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const preMorph = React.useRef<JumpSnapshot | null>(null);
  const pendingJump = React.useRef<Result | null>(null);
  const frames = React.useRef(new FrameMonitor());

  const advance = React.useCallback(() => {
    setIndex((i) => (i + 1) % test.values.length);
  }, [test.values.length]);

  React.useEffect(() => {
    setIndex(0);
    setAuto(false);
    setNotes("");
    setCopied(false);
    setDom(null);
    setJump(null);
    setPerf(null);
  }, [test.label]);

  React.useEffect(() => {
    const monitor = frames.current;
    return () => {
      monitor.stop();
    };
  }, []);

  const root = () =>
    stageRef.current?.querySelector<HTMLElement>("[torph-root]") ?? null;

  const handleStart = () => {
    if (!showChecks) return;
    frames.current.start();
    const el = root();
    if (!el) return;
    preMorph.current = takeJumpSnapshot(el);
    // Sampled a frame in, but reported on completion — a state update
    // mid-animation would re-render the thing being measured.
    requestAnimationFrame(() => {
      if (preMorph.current) {
        pendingJump.current = verifyNoJump(el, preMorph.current);
      }
    });
  };

  const handleComplete = () => {
    if (!showChecks) return;
    setPerf(frames.current.stop());
    if (pendingJump.current) {
      setJump(pendingJump.current);
      pendingJump.current = null;
    }
    const el = root();
    if (!el) return;
    setDom(
      tabular
        ? combineResults(verifyDomStandard(el), verifyTabularDigits(el))
        : verifyDomStandard(el),
    );
  };

  React.useEffect(() => {
    if (!auto) return;
    const id = setInterval(advance, 150);
    return () => clearInterval(id);
  }, [auto, advance]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  const prev = (index - 1 + test.values.length) % test.values.length;
  const cursor =
    useCursors && test.cursors ? test.cursors[index] : undefined;

  const handleCopy = async () => {
    const ok = await copyText(
      buildNumberIssueReport({
        test,
        index,
        speed,
        easing,
        align,
        locale,
        decimals,
        cursor,
        result,
        notes: notes.trim() || undefined,
      }),
    );
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>{test.label}</h2>
        <div className={styles.tags}>
          {test.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      <p className={styles.detailDescription}>{test.description}</p>

      <div
        ref={stageRef}
        className={styles.stage}
        style={{
          textAlign: align,
          fontVariantNumeric: tabular ? "tabular-nums" : "normal",
        }}
        onClick={advance}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && advance()}
      >
        <TextMorph
          duration={SPEEDS[speed]}
          ease={EASINGS[easing]}
          locale={locale}
          decimals={decimals}
          cursorIndex={cursor}
          onAnimationStart={handleStart}
          onAnimationComplete={handleComplete}
        >
          {test.values[index]!}
        </TextMorph>
      </div>

      <div className={styles.stageBar}>
        <span className={styles.step}>
          {index + 1} / {test.values.length}
        </span>
        <button type="button" className={styles.primaryBtn} onClick={advance}>
          Morph
        </button>
        {test.tags.includes("spam") && (
          <button
            type="button"
            className={`${styles.btn} ${auto ? styles.btnActive : ""}`}
            onClick={() => setAuto((a) => !a)}
          >
            {auto ? "Stop" : "Auto"}
          </button>
        )}
        {test.cursors && (
          <button
            type="button"
            className={`${styles.btn} ${useCursors ? styles.btnActive : ""}`}
            onClick={() => setUseCursors((c) => !c)}
            title="Drive matching from the caret instead of place value — turn it off to see what the same edit looks like to a counter"
          >
            cursor
          </button>
        )}
        {test.tabular && (
          <span className={styles.step} title="This case renders with tabular figures">
            tabular
          </span>
        )}
        <button
          type="button"
          className={`${styles.btn} ${showInspector ? styles.btnActive : ""}`}
          onClick={() => setShowInspector((s) => !s)}
        >
          Places
        </button>
        <button
          type="button"
          className={`${styles.btn} ${showChecks ? styles.btnActive : ""}`}
          onClick={() => setShowChecks((s) => !s)}
          title="Layout, style-cleanup and frame checks — run on each morph"
        >
          DOM
        </button>
        <span className={styles.spacer} />
        <span className={result?.pass ? styles.pass : styles.fail}>
          {result ? (result.pass ? "PASS" : "FAIL") : "…"}
        </span>
      </div>

      {result && <p className={styles.assertion}>{result.detail}</p>}

      {showChecks && (
        <div className={styles.checks}>
          {(
            [
              ["DOM", dom],
              ["JUMP", jump],
              [
                "FRAMES",
                perf
                  ? {
                      pass: perf.pass,
                      detail: `${perf.totalFrames} frames, ${perf.droppedFrames} dropped, longest ${perf.longestFrame.toFixed(1)}ms — ${perf.detail}`,
                    }
                  : null,
              ],
            ] as const
          ).map(([name, r]) => (
            <div key={name} className={styles.checkRow}>
              <span
                className={
                  r ? (r.pass ? styles.pass : styles.fail) : styles.pending
                }
              >
                {r ? (r.pass ? "PASS" : "FAIL") : "…"}
              </span>
              <span className={styles.checkName}>{name}</span>
              <span className={styles.checkDetail}>
                {r ? r.detail : "morph to run"}
              </span>
            </div>
          ))}
        </div>
      )}

      {showInspector && (
        <AlignmentInspector
          from={formatValue(test.values[prev]!, locale, decimals)}
          to={formatValue(test.values[index]!, locale, decimals)}
          cursor={cursor}
          decimalChar={decimalChar}
        />
      )}

      <div className={styles.issueBox}>
        <input
          className={styles.notesInput}
          placeholder="What looks wrong? (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" className={styles.btn} onClick={handleCopy}>
          {copied ? "Copied" : "Copy issue"}
        </button>
      </div>
    </div>
  );
}
