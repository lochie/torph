import styles from "./inline.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

import { wrap } from "./wrap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useCycle } from "./use-cycle";
import { AnimatePresence, motion } from "motion/react";

export const COUNTS = [3, 13, 9, 128, 7];

export const InlineCount = () => {
  const index = useCycle(COUNTS.length, 2200);

  return (
    <div className={styles.stage}>
      <TextMorph>{`${COUNTS[index]!} unread messages`}</TextMorph>
    </div>
  );
};

export const RESULTS = [
  { shown: 24, total: 1208 },
  { shown: 24, total: 986 },
  { shown: 12, total: 986 },
  { shown: 12, total: 47 },
];

export const ResultsSummary = () => {
  const index = useCycle(RESULTS.length, 2000);
  const { shown, total } = RESULTS[index]!;

  return (
    <div className={`${styles.stage} ${styles.stageSmall}`}>
      <TextMorph>
        {`Showing ${shown} of ${total.toLocaleString("en")} results`}
      </TextMorph>
    </div>
  );
};

export const AmountField = () => {
  const [value, setValue] = React.useState("20");
  const [caret, setCaret] = React.useState<number>();

  return (
    <div className={styles.field}>
      <TextMorph
        className={`${styles.stage} ${styles.stageLarge}`}
        // The morphed value carries a "$" the field does not, so the caret shifts.
        cursorIndex={caret === undefined ? undefined : caret + 1}
      >
        {`$${value || "0"}`}
      </TextMorph>

      <input
        className={styles.fieldInput}
        value={value}
        inputMode="decimal"
        aria-label="Amount"
        onChange={(event) => {
          setCaret(event.target.selectionStart ?? undefined);
          setValue(event.target.value);
        }}
      />
    </div>
  );
};

export const WALLET = [
  "Connect wallet",
  "Connecting\u2026",
  "0xd55a\u2026d2685",
  "lochie.eth",
];

export const Wallet = () => {
  const index = useCycle(WALLET.length, 1800);

  return (
    <div className={styles.chip}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <AnimatePresence>
          {index >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0.5, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.img
                src="https://lochie.me/avatar.jpg"
                alt=""
                width={20}
                height={20}
                style={{
                  borderRadius: "50%",
                  marginRight: "0.5rem",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <TextMorph>{WALLET[index]!}</TextMorph>
      </div>
    </div>
  );
};

export const RUN = 2000;
export const TICK = 100;

const easeInQuad = (t: number) => t * t;

type Phase = "idle" | "downloading" | "done";

const NEXT: Record<Exclude<Phase, "downloading">, [Phase, number]> = {
  idle: ["downloading", 900],
  done: ["idle", 1600],
};

export const Download = () => {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;

    if (phase !== "downloading") {
      const [next, delay] = NEXT[phase];
      const timer = window.setTimeout(() => {
        if (next === "idle") setProgress(0);
        setPhase(next);
      }, delay);
      return () => window.clearTimeout(timer);
    }

    const started = Date.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / RUN);
      setProgress(easeInQuad(t) * 100);
      if (t === 1) setPhase("done");
    }, TICK);
    return () => window.clearInterval(id);
  }, [phase, reducedMotion]);

  const label =
    phase === "idle"
      ? "Download"
      : phase === "done"
        ? "Downloaded"
        : `${Math.round(progress)}%`;

  const filled =
    phase === "done" ? 100 : phase === "downloading" ? progress : 0;

  return (
    <div className={styles.download}>
      <div className={styles.chip}>
        <TextMorph duration={600} ease={`cubic-bezier(0.41, 1.03, 0.6, 1.03)`}>
          {label}
        </TextMorph>
      </div>

      <div className={styles.track} aria-hidden>
        <div
          className={styles.fill}
          style={{
            width: `${filled}%`,
            // Emptying for the next run should be instant, not a drain backwards.
            transitionDuration: phase === "downloading" ? `${TICK}ms` : "0ms",
          }}
        />
      </div>
    </div>
  );
};

export const FILTERS = [
  "All Markets",
  "Markets (1)",
  "Markets (2)",
  "Markets (3)",
];

export const Filters = () => {
  const index = useCycle(FILTERS.length, 1500);

  return (
    <div className={styles.chip}>
      <TextMorph>{FILTERS[index]!}</TextMorph>
    </div>
  );
};

export const ANNOUNCED = [
  "Processing transaction",
  "Transaction confirmed",
  "Receipt emailed",
];

export const Announced = () => {
  const index = useCycle(ANNOUNCED.length, 2200);
  const value = ANNOUNCED[index]!;

  return (
    <div className={styles.announced}>
      <div aria-live="polite" className={styles.chip}>
        <TextMorph>{value}</TextMorph>
      </div>

      <span className={styles.caption}>“{value}”</span>
    </div>
  );
};

export const DRAFT = "The capital of France is Lyon, a city in the east.";
export const REVISED = "The capital of France is Paris, a city in the north.";
export const WORDS = DRAFT.split(" ");
// One past the last word is the settled pause; two is the correction.
export const STEPS = WORDS.length + 2;

export const Streaming = () => {
  const [step, setStep] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const delay =
      step < WORDS.length - 1 ? 110 : step === WORDS.length - 1 ? 900 : 2400;
    const timer = window.setTimeout(
      () => setStep((s) => (s + 1) % STEPS),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [step, reducedMotion]);

  const text =
    step >= WORDS.length + 1 ? REVISED : WORDS.slice(0, step + 1).join(" ");

  return <TextMorph className={styles.prose}>{wrap(text, 28)}</TextMorph>;
};

export const Rename = () => {
  const [title, setTitle] = React.useState("Q4 report");

  return (
    <div className={styles.field}>
      <TextMorph className={styles.stage}>{title || "Untitled"}</TextMorph>

      <input
        className={styles.fieldInput}
        value={title}
        maxLength={32}
        aria-label="Document title"
        onChange={(event) => setTitle(event.target.value)}
      />
    </div>
  );
};
