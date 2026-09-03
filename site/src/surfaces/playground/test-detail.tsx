import React from "react";
import { TextMorph } from "torph/react";
import styles from "./styles.module.scss";
import { torph } from "./tests";
import type { BenchCase } from "./tests";
import { buildIssueReport, copyText } from "./issue";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";
import type { Result } from "@torph/test-cases";
import { combineResults } from "@torph/test-cases";
import type { JumpSnapshot, PerfResult } from "./verify-dom";
import {
  FrameMonitor,
  takeJumpSnapshot,
  verifyDomStandard,
  verifyMultiline,
  verifyNoJump,
} from "./verify-dom";

function SegmentInspector({ from, to }: { from: string; to: string }) {
  const old = torph.segmentText(from, "en");
  const { segments, splits } = torph.diffSegments(old, to, "en");
  const oldIds = new Set(old.map((s) => s.id));

  const show = (v: string) =>
    v === " " ? "·" : v === "\n" ? "↵" : v === "​" ? "∅" : v;

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorRow}>
        <span className={styles.inspectorLabel}>before</span>
        <div className={styles.chips}>
          {old.map((s, i) => (
            <span key={i} className={styles.chip} title={s.id}>
              {show(s.string)}
              <em>{s.id}</em>
            </span>
          ))}
        </div>
      </div>
      <div className={styles.inspectorRow}>
        <span className={styles.inspectorLabel}>after</span>
        <div className={styles.chips}>
          {segments.map((s, i) => (
            <span
              key={i}
              className={`${styles.chip} ${
                oldIds.has(s.id) ? styles.chipPersisted : styles.chipNew
              }`}
              title={`${s.id} — ${oldIds.has(s.id) ? "persisted" : "entered"}`}
            >
              {show(s.string)}
              <em>{s.id}</em>
            </span>
          ))}
        </div>
      </div>
      {splits.size > 0 && (
        <div className={styles.inspectorRow}>
          <span className={styles.inspectorLabel}>splits</span>
          <div className={styles.chips}>
            {[...splits.entries()].map(([word, chars]) => (
              <span key={word} className={styles.chip}>
                {word}
                <em>{chars.length} chars</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TestDetail({
  test,
  result,
  speed,
  easing,
  align: globalAlign,
  debug,
  onTagClick,
}: {
  test: BenchCase;
  result: Result | null;
  speed: Speed;
  easing: EasingKey;
  align: Align;
  debug: boolean;
  onTagClick?: (tag: string) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [showInspector, setShowInspector] = React.useState(false);
  const [showChecks, setShowChecks] = React.useState(false);
  const [auto, setAuto] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const align = test.align ?? globalAlign;

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
    // Reported on completion: a state update mid-morph re-renders what it measures.
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
      test.minLines
        ? combineResults(
            verifyDomStandard(el),
            verifyMultiline(el, test.minLines),
          )
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

  const handleCopy = async () => {
    const ok = await copyText(
      buildIssueReport({
        test,
        index,
        speed,
        easing,
        align: globalAlign,
        debug,
        result,
        notes: notes.trim() || undefined,
      }),
    );
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const prev = (index - 1 + test.values.length) % test.values.length;

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
        style={{ textAlign: align }}
        // A pointer convenience, not a control — the "Morph" button is that.
        onClick={advance}
      >
        <TextMorph
          duration={SPEEDS[speed]}
          ease={EASINGS[easing]}
          debug={debug}
          onAnimationStart={handleStart}
          onAnimationComplete={handleComplete}
        >
          {test.values[index]}
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
        <button
          type="button"
          className={`${styles.btn} ${showInspector ? styles.btnActive : ""}`}
          onClick={() => setShowInspector((s) => !s)}
        >
          Segments
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
        <SegmentInspector from={test.values[prev]!} to={test.values[index]!} />
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
