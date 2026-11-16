import React from "react";
import { TextMorph } from "torph/react";
import type { Result } from "@torph/test-cases";
import styles from "./styles.module.scss";
import { Scrubber } from "./scrubber";
import { FONTS, type FontKey } from "./kerning-demo";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";

// What plain text gets right and boxes don't: kerned pairs, ligatures, joining
// scripts, and a number and a second line to split around.
const SPECIMENS = [
  ["AVATAR Typo", "AVAST Type"],
  ["Copy", "Copied"],
  ["office a->b", "fifty a=>b"],
  ["7.5", "7.25"],
  ["במבט", "בכבס"],
  ["مرحبا", "سلام"],
  ["Total\n$1,234", "Total\n$5,678"],
] as const;

const TOLERANCE = 1; // px — WebKit snaps per-character rects to whole pixels.

type Glyph = { text: string; x: number; y: number };

const translateOf = (element: Element) => {
  const { transform } = getComputedStyle(element);
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.e, y: matrix.f };
};

/** The rect of a node's first character, measured from the root. */
function firstGlyph(node: Text, offset: number, root: DOMRect) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, Math.min(offset + 1, node.length));
  const rect = range.getBoundingClientRect();
  return { x: rect.left - root.left, y: rect.top - root.top };
}

/** Where each box's first glyph sits once every transform has played out. */
function boxGlyphs(root: HTMLElement): Glyph[] | null {
  const boxes = Array.from(
    root.querySelectorAll<HTMLElement>("[torph-item]:not([torph-exiting])"),
  );
  if (boxes.length === 0) return null;
  const origin = root.getBoundingClientRect();
  return boxes.map((box) => {
    if (box.tagName === "BR") return { text: "\n", x: 0, y: 0 };
    const node = document
      .createTreeWalker(box, NodeFilter.SHOW_TEXT)
      .nextNode() as Text | null;
    if (!node) return { text: "", x: 0, y: 0 };
    const at = firstGlyph(node, 0, origin);
    // A slot's glyph sits in a span that slides on its own.
    let x = at.x;
    let y = at.y;
    for (
      let el: Element | null = node.parentElement;
      el && el !== root;
      el = el.parentElement
    ) {
      const t = translateOf(el);
      x -= t.x;
      y -= t.y;
    }
    return { text: box.textContent ?? "", x, y };
  });
}

/** How far each box's first glyph moves when the boxes give way to the text. */
function snapAtJoin(root: HTMLElement, glyphs: Glyph[]): Result | null {
  const text = root.querySelector("[torph-text]");
  if (!text) return null;
  const lines = Array.from(text.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  );
  const origin = root.getBoundingClientRect();
  let line = 0;
  let offset = 0;
  let dx = 0;
  let dy = 0;
  for (const glyph of glyphs) {
    if (glyph.text === "\n") {
      line++;
      offset = 0;
      continue;
    }
    const node = lines[line];
    if (!node || offset >= node.length) return null;
    const at = firstGlyph(node, offset, origin);
    dx = Math.max(dx, Math.abs(at.x - glyph.x));
    dy = Math.max(dy, Math.abs(at.y - glyph.y));
    offset += glyph.text.length;
  }
  return {
    pass: dx <= TOLERANCE && dy <= TOLERANCE,
    detail: `boxes joined back into text; glyphs moved ${dx.toFixed(2)}px across, ${dy.toFixed(2)}px down at most`,
  };
}

/**
 * Between morphs the value is plain text, so the browser shapes all of it. A
 * morph splits it into boxes fitted to that text and joins them back once
 * everything has settled; the join is where a mismatch would show.
 */
export function RestDemo({
  speed,
  easing,
  align,
}: {
  speed: Speed;
  easing: EasingKey;
  align: Align;
}) {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const cells = React.useRef<(HTMLElement | null)[]>([]);
  const [step, setStep] = React.useState(0);
  const [font, setFont] = React.useState<FontKey>("inter");
  const [weight, setWeight] = React.useState(400);
  const [debug, setDebug] = React.useState(false);
  const [states, setStates] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<(Result | null)[]>([]);

  const duration = SPEEDS[speed];
  const justifyItems =
    align === "left" ? "start" : align === "right" ? "end" : "center";

  // Every frame: what each root is drawing, and, the frame its boxes go, the snap.
  React.useEffect(() => {
    const last: (Glyph[] | null)[] = [];
    let frame = 0;
    const tick = () => {
      const next = cells.current.map((cell, i) => {
        const root = cell?.querySelector<HTMLElement>("[torph-root]");
        if (!root) return "";
        const glyphs = boxGlyphs(root);
        if (glyphs) {
          last[i] = glyphs;
          return `${glyphs.length} boxes`;
        }
        const before = last[i];
        if (before) {
          last[i] = null;
          const result = snapAtJoin(root, before);
          setResults((rs) => {
            const copy = [...rs];
            copy[i] = result;
            return copy;
          });
        }
        return root.querySelector("[torph-text]") ? "plain text" : "";
      });
      setStates((prev) =>
        prev.length === next.length && prev.every((s, i) => s === next[i])
          ? prev
          : next,
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const failing = results.filter((r) => r && !r.pass).length;
  const measured = results.filter(Boolean).length;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Plain text at rest</h2>
      </header>

      <p className={styles.detailDescription}>
        While nothing moves, torph draws the value as plain text, so the browser
        shapes it: kerning, ligatures, joining scripts. A morph splits it into
        boxes fitted to that text and joins them back once everything settles;
        each row reports how far any glyph moved at that join. Change the font
        or weight at rest — no morph needed for the text to follow.
      </p>

      <div
        ref={stageRef}
        className={styles.stage}
        role="presentation"
        onClick={() => setStep((s) => s + 1)}
      >
        <div className={styles.restRows}>
          {SPECIMENS.map((values, i) => (
            <React.Fragment key={values.join()}>
              <div
                ref={(el) => {
                  cells.current[i] = el;
                }}
                className={styles.restCell}
                style={{
                  fontFamily: FONTS[font],
                  fontWeight: weight,
                  justifyItems,
                }}
              >
                <TextMorph
                  duration={duration}
                  ease={EASINGS[easing]}
                  debug={debug}
                >
                  {values[step % values.length]!}
                </TextMorph>
              </div>
              <span
                className={
                  states[i] === "plain text"
                    ? styles.restText
                    : styles.restBoxes
                }
              >
                {states[i] || "…"}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className={styles.stageBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => setStep((s) => s + 1)}
        >
          morph
        </button>
        <div className={styles.group}>
          {(Object.keys(FONTS) as FontKey[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.btn} ${font === f ? styles.btnActive : ""}`}
              onClick={() => setFont(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <label className={styles.range} title="font-weight, changed at rest">
          <input
            type="range"
            min={100}
            max={900}
            step={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
          <code>{weight}</code>
        </label>
        <button
          type="button"
          className={`${styles.btn} ${debug ? styles.tagActive : ""}`}
          onClick={() => setDebug((d) => !d)}
          title="Outline the root and, while a morph runs, each box"
        >
          debug
        </button>
        <Scrubber target={stageRef} duration={duration} />
        <span className={styles.spacer} />
        <span
          className={
            measured < SPECIMENS.length
              ? styles.pending
              : failing
                ? styles.fail
                : styles.pass
          }
        >
          {measured < SPECIMENS.length
            ? "…"
            : failing
              ? `${failing} FAIL`
              : "PASS"}
        </span>
      </div>

      <div className={styles.checks}>
        {SPECIMENS.map((values, i) => {
          const r = results[i];
          return (
            <div key={values.join()} className={styles.checkRow}>
              <span
                className={
                  r ? (r.pass ? styles.pass : styles.fail) : styles.pending
                }
              >
                {r ? (r.pass ? "PASS" : "FAIL") : "…"}
              </span>
              <span className={styles.checkName}>
                {values[step % values.length]!.replace("\n", " ↵ ")}
              </span>
              <span className={styles.checkDetail}>
                {r
                  ? r.detail
                  : "morph, then let it settle, to measure the join"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
