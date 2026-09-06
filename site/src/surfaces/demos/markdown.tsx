import styles from "./markdown.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

// An inline tag around a run of text is carried as a format, so the words keep
// travelling as they gain one — the markers leave and the emphasis stays put.

export const MARKDOWN = [
  "# Torph",
  "Markdown **resolves** as you type, into `real blocks`,",
  "_emphasis_, ~~edits~~, and [links](https://torph.lochie.me).",
  "- Every line is a line of the value",
  "- Every marker leaves when its pair lands",
  "> The words never re-render. They move.",
].join("\n");

type Inline = {
  text: string;
  kind?: "bold" | "italic" | "strike" | "code" | "link";
  href?: string;
};

/** What a line renders to — a concrete union, so an array of them is a child. */
type Node = React.JSX.Element | string;

type Line = {
  /** Drawn before the words, and not part of them: a bullet, a number, an indent. */
  prefix?: string;
  heading?: number;
  quote?: boolean;
  runs: Inline[];
};

// Longest marker first, or `**` reads as two italics and `~~` as two strikes.
const MARKERS: [mark: string, kind: Inline["kind"]][] = [
  ["**", "bold"],
  ["~~", "strike"],
  ["`", "code"],
  ["_", "italic"],
  ["*", "italic"],
];

/**
 * A marker with nothing to close it is still ordinary text — which is what makes the
 * syntax disappear at the moment its pair lands, rather than on arrival.
 */
function inlineRuns(text: string): Inline[] {
  const runs: Inline[] = [];
  let plain = "";

  const flush = () => {
    if (plain) runs.push({ text: plain });
    plain = "";
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === "[") {
      const split = text.indexOf("](", i);
      const close = split === -1 ? -1 : text.indexOf(")", split + 2);
      if (close !== -1) {
        flush();
        runs.push({
          text: text.slice(i + 1, split),
          kind: "link",
          href: text.slice(split + 2, close),
        });
        i = close + 1;
        continue;
      }
    }

    const marker = MARKERS.find(([mark]) => text.startsWith(mark, i));
    if (!marker) {
      plain += text[i];
      i += 1;
      continue;
    }

    const [mark, kind] = marker;
    const close = text.indexOf(mark, i + mark.length);
    if (close === -1) {
      plain += text.slice(i);
      break;
    }

    flush();
    runs.push({ text: text.slice(i + mark.length, close), kind });
    i = close + mark.length;
  }

  flush();
  return runs;
}

const HEADING = /^(#{1,6}) +(.*)$/;
const BULLET = /^(\s*)[-*] +(.*)$/;
const ORDERED = /^(\s*)(\d+)\. +(.*)$/;
const QUOTE = /^> ?(.*)$/;

/** Blocks first, then what is inside them. A line is the unit either way. */
export function parseMarkdown(source: string): Line[] {
  return source.split("\n").map((raw) => {
    const heading = HEADING.exec(raw);
    if (heading) {
      return { heading: heading[1]!.length, runs: inlineRuns(heading[2]!) };
    }

    const ordered = ORDERED.exec(raw);
    if (ordered) {
      const indent = " ".repeat(ordered[1]!.length);
      return {
        prefix: `${indent}${ordered[2]}. `,
        runs: inlineRuns(ordered[3]!),
      };
    }

    const bullet = BULLET.exec(raw);
    if (bullet) {
      const indent = " ".repeat(bullet[1]!.length);
      return { prefix: `${indent}• `, runs: inlineRuns(bullet[2]!) };
    }

    const quote = QUOTE.exec(raw);
    if (quote) return { quote: true, runs: inlineRuns(quote[1]!) };

    return { runs: inlineRuns(raw) };
  });
}

/**
 * Editing happens on the rendered line: the source sits in a transparent textarea
 * covering it, so what you see and what you type are the same surface. The caret is
 * drawn as a segment of the value, and the selection is held at the end, or it would
 * be pointing at a character the markers moved.
 */
export const MarkdownField = () => {
  const [value, setValue] = React.useState(MARKDOWN);
  const [editing, setEditing] = React.useState(false);
  const input = React.useRef<HTMLTextAreaElement>(null);

  const toEnd = () => {
    const field = input.current;
    if (!field || field.selectionStart === field.value.length) return;
    field.setSelectionRange(field.value.length, field.value.length);
  };

  return (
    <div
      className={styles.field}
      onPointerDown={(event) => {
        event.preventDefault();
        input.current?.focus();
      }}
    >
      <div className={styles.prose}>
        <TextMorph duration={320}>
          {parseMarkdown(value).flatMap((line, index) => {
            const key = (suffix: string) => `${index}:${suffix}`;

            // Keyed here rather than wrapped in a fragment: a fragment is an element
            // to `Children.toArray`, and the morph would take it for a thing.
            const words = line.runs.map((run, i) =>
              run.kind === "bold" ? (
                <strong key={key(`b${i}`)}>{run.text}</strong>
              ) : run.kind === "italic" ? (
                <em key={key(`i${i}`)}>{run.text}</em>
              ) : run.kind === "strike" ? (
                <s key={key(`s${i}`)}>{run.text}</s>
              ) : run.kind === "code" ? (
                <span
                  key={key(`c${i}`)}
                  data-torph-format
                  className={styles.inlineCode}
                >
                  {run.text}
                </span>
              ) : run.kind === "link" ? (
                // A real anchor, named by its whole run rather than letter by letter.
                <a
                  key={key(`a${i}`)}
                  data-torph-format
                  data-torph-interactive
                  className={styles.link}
                  href={run.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {run.text}
                </a>
              ) : (
                run.text
              ),
            );

            const body: Node[] = line.prefix
              ? [
                  <span
                    key={key("mark")}
                    data-torph-format
                    className={styles.marker}
                  >
                    {line.prefix}
                  </span>,
                  ...words,
                ]
              : words;

            const block: Node[] = line.heading
              ? [
                  React.createElement(
                    `h${Math.min(line.heading, 6)}`,
                    {
                      key: key("h"),
                      "data-torph-format": "",
                      className: line.heading === 1 ? styles.h1 : styles.h2,
                    },
                    body,
                  ),
                ]
              : line.quote
                ? [
                    <span
                      key={key("q")}
                      data-torph-format
                      className={styles.quote}
                    >
                      {body}
                    </span>,
                  ]
                : body;

            return index === 0 ? block : ["\n", ...block];
          })}
          {editing ? (
            <span key="caret" className={styles.caret} aria-hidden="true" />
          ) : (
            ""
          )}
        </TextMorph>
      </div>

      <textarea
        ref={input}
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          setEditing(true);
          toEnd();
        }}
        onBlur={() => setEditing(false)}
        onSelect={toEnd}
        spellCheck={false}
        aria-label="Markdown source"
      />
    </div>
  );
};
