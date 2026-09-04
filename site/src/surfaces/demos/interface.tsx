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
      <TextMorph
        ease={{
          stiffness: 150,
          damping: 19,
          mass: 1.2,
        }}
      >
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
      <div
        className={styles.chip}
        style={{
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <TextMorph duration={300} ease={`cubic-bezier(0.41, 1.03, 0.6, 1.03)`}>
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

export const STREAM =
  "The capital of Australia is Canberra, which sits in the Australian Capital Territory between Sydney and Melbourne. It was chosen in 1908 as a compromise between the two rival cities, and Walter Burley Griffin and Marion Mahony Griffin won the competition to design it. Their plan set the city around a lake and a grid of axes and circles, and today it holds Parliament House, the High Court, and the National Gallery.";
export const STREAM_WORDS = STREAM.split(" ");

const STREAM_MS = 110;
const STREAM_HOLD = 2400; // Beat on the finished passage before it starts over

export const Streaming = () => {
  const [count, setCount] = React.useState(1);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const done = count >= STREAM_WORDS.length;
    const timer = window.setTimeout(
      () => setCount((n) => (done ? 1 : n + 1)),
      done ? STREAM_HOLD : STREAM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [count, reducedMotion]);

  const shown = reducedMotion ? STREAM_WORDS.length : count;

  return (
    <div className={styles.prose}>
      <TextMorph>{wrap(STREAM_WORDS.slice(0, shown).join(" "), 28)}</TextMorph>
    </div>
  );
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
