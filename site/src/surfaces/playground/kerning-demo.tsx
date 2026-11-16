import React from "react";
import { Inter, Playfair_Display } from "next/font/google";
import { TextMorph } from "torph/react";
import type { Result } from "@torph/test-cases";
import styles from "./styles.module.scss";
import { Scrubber } from "./scrubber";
import { verifyKerning } from "./verify-dom";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";

// Whole words, arrows Inter and Playfair draw as one glyph, and Playfair's fi/ffi
// ligatures — each of which needs one box to form.
const WORDS = [
  ["AVATAR", "AVAST"],
  ["Typo", "Type"],
  ["Copy", "Copied"],
  ["WAVE", "Wavy"],
  ["7.5", "7.25"],
  ["a=>b", "a->b", "a<->b"],
  ["office", "fifty"],
] as const;

// The deepest and furthest-reaching pairs in a typical kern table, and the common
// ones. Each is its own morph — a space would make them words, and a word kerns
// natively.
const PAIRS = [
  "'J",
  "7.",
  "To",
  "Te",
  "K-",
  "7A",
  "V.",
  "LT",
  "PJ",
  "oT",
  "AV",
  "VA",
  "AT",
  "Yo",
  "Ta",
  "AY",
  "FA",
  "L'",
  "rv",
  "rt",
  "tr",
];

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ subsets: ["latin"] });

const FONTS = {
  inter: inter.style.fontFamily,
  playfair: playfair.style.fontFamily,
  site: "var(--font-secondary)",
  system: "system-ui, sans-serif",
} as const;
type FontKey = keyof typeof FONTS;

type Checked = Result & { off: number };

const COLUMNS = ["plain text", "torph", "before — a box per letter"];

/**
 * Every letter is its own box, which a browser never kerns across, so the engine
 * puts each pair's kerning back as a margin. Each specimen is set three ways — as
 * one plain run, morphed, and a box per letter — with the plain run in red behind
 * the other two.
 */
export function KerningDemo({
  speed,
  easing,
  align,
}: {
  speed: Speed;
  easing: EasingKey;
  align: Align;
}) {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [step, setStep] = React.useState(0);
  const [font, setFont] = React.useState<FontKey>("inter");
  const [kerning, setKerning] = React.useState(true);
  const [ghost, setGhost] = React.useState(true);
  const [results, setResults] = React.useState<(Checked | null)[]>([]);
  const cells = React.useRef<(HTMLElement | null)[]>([]);
  const refs = React.useRef<(HTMLElement | null)[]>([]);

  // Every pair cell steps to the next pair, so each one morphs as well as mounts.
  const texts = [
    ...WORDS.map((values) => values[step % values.length]!),
    ...PAIRS.map((_, i) => PAIRS[(i + step) % PAIRS.length]!),
  ];
  const duration = SPEEDS[speed];
  const justifyItems =
    align === "left" ? "start" : align === "right" ? "end" : "center";
  const specimen: React.CSSProperties = {
    fontFamily: FONTS[font],
    fontKerning: kerning ? "auto" : "none",
    justifyItems,
  };

  // Checked once the morph has landed — mid-flight the boxes are still travelling.
  React.useEffect(() => {
    setResults([]);
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      setResults(
        cells.current.map((cell, i) => {
          const root = cell?.querySelector<HTMLElement>("[torph-root]");
          const reference = refs.current[i];
          return root && reference ? verifyKerning(root, reference) : null;
        }),
      );
    };
    const timer = setTimeout(
      () => void document.fonts.ready.then(run),
      duration + 100,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, font, kerning, duration]);

  const ghostStyle = { opacity: ghost ? 1 : 0 };

  const renderSpecimen = (i: number, className: string) => (
    <div
      // Kerning is measured on update, not watched, so a restyle starts the cells over.
      key={`${i}${font}${kerning}`}
      ref={(el) => {
        cells.current[i] = el;
      }}
      className={className}
      style={specimen}
    >
      <span
        ref={(el) => {
          refs.current[i] = el;
        }}
        className={styles.kerningGhost}
        style={ghostStyle}
        aria-hidden
      >
        {texts[i]}
      </span>
      <TextMorph duration={duration} ease={EASINGS[easing]}>
        {texts[i]!}
      </TextMorph>
    </div>
  );

  const renderTorph = (i: number) => renderSpecimen(i, styles.kerningRow!);

  const ghostOf = (i: number) => (
    <span className={styles.kerningGhost} style={ghostStyle} aria-hidden>
      {texts[i]}
    </span>
  );

  const renderPlain = (i: number) => (
    <div key={`plain${i}`} className={styles.kerningRow} style={specimen}>
      <span className={styles.kerningPlain}>{texts[i]}</span>
    </div>
  );

  // What torph drew before it kerned: a box per letter, nothing between them.
  const renderBefore = (i: number) => (
    <div key={`before${i}`} className={styles.kerningRow} style={specimen}>
      {ghostOf(i)}
      <span className={styles.kerningSplit} aria-hidden>
        {Array.from(texts[i]!).map((char, j) => (
          <span key={j}>{char}</span>
        ))}
      </span>
    </div>
  );

  const pairResults = results.slice(WORDS.length);
  const pairFailures = pairResults.flatMap((r, i) =>
    r && !r.pass ? [`${texts[WORDS.length + i]} ${signed(r.off)}`] : [],
  );
  const worstPair = Math.max(
    0,
    ...pairResults.map((r) => Math.abs(r?.off ?? 0)),
  );
  const pairsDone =
    pairResults.length === PAIRS.length && pairResults.every(Boolean);
  const pairSummary: Result | null = pairsDone
    ? {
        pass: pairFailures.length === 0,
        detail: pairFailures.length
          ? pairFailures.join(", ")
          : `${PAIRS.length} pairs match as one run (worst ±${worstPair.toFixed(2)}px)`,
      }
    : null;

  const rows: [string, Result | null][] = [
    ...WORDS.map((_, i): [string, Result | null] => [
      texts[i]!,
      results[i] ?? null,
    ]),
    ["pairs", pairSummary],
  ];
  const done = rows.every(([, r]) => r);
  const failing = rows.filter(([, r]) => r && !r.pass).length;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>Kerning</h2>
      </header>

      <p className={styles.detailDescription}>
        Each letter is its own box, and browsers don&apos;t kern across boxes,
        so torph adds each pair&apos;s kerning back itself. Each specimen is
        shown as plain text, through torph, and split into a box per letter the
        way torph drew it before. The plain text sits in red behind the other
        two: torph should cover it exactly, while the split version shows red
        wherever a pair has lost its kerning or a ligature has failed to form.
      </p>

      <div
        ref={stageRef}
        className={styles.stage}
        role="presentation"
        onClick={() => setStep((s) => s + 1)}
      >
        <div className={styles.kerningCompare} style={{ justifyItems }}>
          {COLUMNS.map((column) => (
            <span key={column} className={styles.kerningColumn}>
              {column}
            </span>
          ))}
          {WORDS.map((_, i) => (
            <React.Fragment key={i}>
              {renderPlain(i)}
              {renderTorph(i)}
              {renderBefore(i)}
            </React.Fragment>
          ))}
          {[renderPlain, renderTorph, renderBefore].map((render, c) => (
            <div key={c} className={styles.kerningPairs}>
              {PAIRS.map((_, i) => render(WORDS.length + i))}
            </div>
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
        <button
          type="button"
          className={`${styles.btn} ${kerning ? styles.tagActive : ""}`}
          onClick={() => setKerning((k) => !k)}
          title="font-kerning: auto / none — with it off, neither copy should kern"
        >
          kerning
        </button>
        <button
          type="button"
          className={`${styles.btn} ${ghost ? styles.tagActive : ""}`}
          onClick={() => setGhost((g) => !g)}
        >
          reference
        </button>
        <Scrubber target={stageRef} duration={duration} />
        <span className={styles.spacer} />
        <span
          className={
            !done ? styles.pending : failing ? styles.fail : styles.pass
          }
        >
          {!done ? "…" : failing ? `${failing} FAIL` : "PASS"}
        </span>
      </div>

      <div className={styles.checks}>
        {rows.map(([name, r], i) => (
          <div key={i} className={styles.checkRow}>
            <span
              className={
                r ? (r.pass ? styles.pass : styles.fail) : styles.pending
              }
            >
              {r ? (r.pass ? "PASS" : "FAIL") : "…"}
            </span>
            <span className={styles.checkName}>{name}</span>
            <span className={styles.checkDetail}>
              {r ? r.detail : "waiting for the morph to land"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}px`;
}
