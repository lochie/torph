import React from "react";
import { TextMorph } from "torph/react";
import type { Result } from "@torph/test-cases";
import { wrap } from "@/surfaces/demos/wrap";
import styles from "./styles.module.scss";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";

const SIZES = [100, 400, 2000] as const;
const LINE = 120; // characters — about the stage's width at this size
type Size = (typeof SIZES)[number];

const WORDS =
  "the quick brown fox jumps over a lazy dog while AVATAR Typo WAVE office fifty Today LT Yo".split(
    " ",
  );
const documentOf = (size: Size) =>
  Array.from({ length: size }, (_, i) => WORDS[(i * 7) % WORDS.length]).join(
    " ",
  );

// Frames slower than this count as dropped at 60 Hz.
const SLOW_FRAME = 34;

/**
 * Long text is where per-item costs multiply: an animation read per box, or a
 * finished animation left attached to every box that ever moved, turns one
 * keystroke into a stall. Edit, type a word, or type into the text yourself.
 */
export function LongTextDemo({
  speed,
  easing,
  align,
}: {
  speed: Speed;
  easing: EasingKey;
  align: Align;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<Size>(400);
  const [text, setText] = React.useState(() => documentOf(400));
  const [lastUpdate, setLastUpdate] = React.useState<number | null>(null);
  const [burst, setBurst] = React.useState<{
    total: number;
    longest: number;
    slow: number;
  } | null>(null);
  const [attached, setAttached] = React.useState(0);
  const [settled, setSettled] = React.useState<Result | null>(null);
  const edits = React.useRef(0);
  const typing = React.useRef(false);

  const duration = SPEEDS[speed];

  // Timed from the change to the end of its first frame, layout included.
  const change = React.useCallback((next: string) => {
    const start = performance.now();
    setText(next);
    requestAnimationFrame(() => {
      void document.body.offsetWidth;
      setLastUpdate(performance.now() - start);
    });
  }, []);

  // Every frame: how many animations the root still holds, and once nothing has
  // changed for a while, whether any were left behind.
  React.useEffect(() => {
    let frame = 0;
    let quiet = 0;
    let lastText = "";
    const tick = () => {
      const root = rootRef.current?.querySelector("[torph-root]");
      const count = root ? root.getAnimations({ subtree: true }).length : 0;
      setAttached(count);
      const current = root?.textContent ?? "";
      quiet = current === lastText ? quiet + 1 : 0;
      lastText = current;
      // Twice the duration plus a margin: every animation should be over by then.
      if (quiet === Math.ceil((duration * 2 + 200) / 16) && !typing.current) {
        const stale = root
          ? root
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "finished").length
          : 0;
        setSettled({
          pass: stale === 0,
          detail:
            stale === 0
              ? "settled with no finished animation left attached"
              : `settled with ${stale} finished animations still attached — every later update sorts them`,
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  const editWord = () => {
    const words = text.split(" ");
    words[words.length >> 1] = `Typography${++edits.current}`;
    change(words.join(" "));
  };

  // Ten keystrokes 60 ms apart into the middle word, each landing mid-animation.
  const typeWord = async () => {
    if (typing.current) return;
    typing.current = true;
    setSettled(null);
    const words = text.split(" ");
    const typed = `Typography${++edits.current}`;
    let longest = 0;
    let slow = 0;
    let last = performance.now();
    let watching = true;
    const watch = () => {
      const now = performance.now();
      const frame = now - last;
      last = now;
      longest = Math.max(longest, frame);
      if (frame > SLOW_FRAME) slow++;
      if (watching) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    const start = performance.now();
    for (let i = 1; i <= typed.length; i++) {
      words[words.length >> 1] = typed.slice(0, i);
      change(words.join(" "));
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    await new Promise((resolve) => setTimeout(resolve, duration + 100));
    watching = false;
    setBurst({ total: performance.now() - start, longest, slow });
    typing.current = false;
  };

  const ms = (n: number) => `${n.toFixed(0)} ms`;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Long text</h2>
      </header>

      <p className={styles.detailDescription}>
        A whole document in one morph. Edit a word, type one in ten quick
        keystrokes, or type into the box yourself. Each update should cost a
        frame or two, typing should not stall, and once the text settles no
        finished animation should be left attached to it.
      </p>

      <div className={styles.longStage} ref={rootRef}>
        <div className={styles.longText} style={{ textAlign: align }}>
          <TextMorph duration={duration} ease={EASINGS[easing]}>
            {wrap(text, LINE)}
          </TextMorph>
        </div>
      </div>

      <div className={styles.stageBar}>
        <button type="button" className={styles.primaryBtn} onClick={editWord}>
          edit a word
        </button>
        <button type="button" className={styles.btn} onClick={typeWord}>
          type a word
        </button>
        <div className={styles.group}>
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.btn} ${size === s ? styles.btnActive : ""}`}
              onClick={() => {
                setSize(s);
                setSettled(null);
                change(documentOf(s));
              }}
            >
              {s} words
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <span
          className={
            settled
              ? settled.pass
                ? styles.pass
                : styles.fail
              : styles.pending
          }
        >
          {settled ? (settled.pass ? "PASS" : "FAIL") : "…"}
        </span>
      </div>

      <textarea
        className={styles.longInput}
        aria-label="Edit the document"
        value={text}
        onChange={(e) => change(e.target.value)}
        rows={3}
      />

      <div className={styles.checks}>
        {(
          [
            [
              "UPDATE",
              lastUpdate === null
                ? null
                : `last update took ${ms(lastUpdate)}, through its first frame`,
            ],
            [
              "TYPING",
              burst &&
                `10 keystrokes in ${ms(burst.total)}; longest frame ${ms(burst.longest)}, ${burst.slow} slower than ${SLOW_FRAME} ms`,
            ],
            ["ATTACHED", `${attached} animations under the root right now`],
          ] as const
        ).map(([name, detail]) => (
          <div key={name} className={styles.checkRow}>
            <span className={styles.pending}>INFO</span>
            <span className={styles.checkName}>{name}</span>
            <span className={styles.checkDetail}>
              {detail ?? "edit or type to measure"}
            </span>
          </div>
        ))}
        <div className={styles.checkRow}>
          <span
            className={
              settled
                ? settled.pass
                  ? styles.pass
                  : styles.fail
                : styles.pending
            }
          >
            {settled ? (settled.pass ? "PASS" : "FAIL") : "…"}
          </span>
          <span className={styles.checkName}>SETTLED</span>
          <span className={styles.checkDetail}>
            {settled?.detail ?? "edit, then let it settle"}
          </span>
        </div>
      </div>
    </div>
  );
}
