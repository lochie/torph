import styles from "./format.module.scss";

import { TextMorph } from "torph/react";

import { useCycle } from "./use-cycle";

// An inline tag around a run of text is carried as a format, so a word can keep
// its colour or its weight while its characters travel — or gain one it never had.

type TokenKind = "keyword" | "fn" | "string" | "number" | "punct";
type Token = [kind: TokenKind | null, text: string];

export const SNIPPETS: Token[][] = [
  [
    ["keyword", "const"],
    [null, " "],
    ["punct", "["],
    [null, "count"],
    ["punct", ","],
    [null, " setCount"],
    ["punct", "]"],
    [null, " =\n  "],
    ["fn", "useState"],
    ["punct", "("],
    ["number", "0"],
    ["punct", ")"],
  ],
  [
    ["keyword", "const"],
    [null, " "],
    ["punct", "["],
    [null, "name"],
    ["punct", ","],
    [null, " setName"],
    ["punct", "]"],
    [null, " =\n  "],
    ["fn", "useState"],
    ["punct", "("],
    ["string", '""'],
    ["punct", ")"],
  ],
  [
    ["keyword", "let"],
    [null, " "],
    ["punct", "["],
    [null, "items"],
    ["punct", ","],
    [null, " setItems"],
    ["punct", "]"],
    [null, " =\n  "],
    ["fn", "useState"],
    ["punct", "(["],
    ["number", "1"],
    ["punct", "])"],
  ],
];

/** Tokens keep their colour while the characters travel, so the line re-shapes. */
export const CodeMorph = () => {
  const index = useCycle(SNIPPETS.length, 2400);

  return (
    <div className={styles.code}>
      <TextMorph duration={520}>
        {SNIPPETS[index]!.map(([kind, text], i) =>
          kind ? (
            // Not <code>: the site styles that one, and a token is not a code block.
            <span key={i} data-torph-format className={styles[kind]}>
              {text}
            </span>
          ) : (
            text
          ),
        )}
      </TextMorph>
    </div>
  );
};

export const SPENDING = [820, 1240, 640, 1480];
const LIMIT = 1000;

/** The colour is animated, not snapped: a segment staying put has nothing else to do. */
export const OverBudget = () => {
  const index = useCycle(SPENDING.length, 2000);
  const spent = SPENDING[index]!;
  const over = spent > LIMIT;

  return (
    <div className={styles.budget}>
      <TextMorph duration={600}>
        {"Spent "}
        <span
          data-torph-format
          className={over ? styles.over : styles.under}
        >{`$${spent.toLocaleString("en")}`}</span>
        {` of $${LIMIT.toLocaleString("en")}`}
      </TextMorph>
    </div>
  );
};

export const CONTACTS = [
  { id: "ana", name: "Ana Chen", tint: "#e2703f" },
  { id: "bo", name: "Bo Marek", tint: "#3f7de2" },
  { id: "cy", name: "Cy Adeyemi", tint: "#8a5fd6" },
];

/** An element and the words that replace it are one value, so one takes the other's place. */
export const Expand = () => {
  const step = useCycle(CONTACTS.length * 2, 1500);
  const contact = CONTACTS[Math.floor(step / 2)]!;
  const open = step % 2 === 1;

  return (
    <div className={styles.expand}>
      <TextMorph duration={520}>
        {open ? (
          contact.name
        ) : (
          <span
            key={contact.id}
            className={styles.face}
            style={{ background: contact.tint }}
            aria-label={contact.name}
          >
            {contact.name[0]}
          </span>
        )}
      </TextMorph>
    </div>
  );
};
