"use client";

import styles from "./styles.module.scss";

import React from "react";
import { useSearchParams } from "next/navigation";
import { TextMorph } from "torph/react";
import { Button } from "@/components/button";
import { Box } from "@/components/box";
import { Dropdown } from "@/components/dropdown";
import { AnimatePresence, motion } from "motion/react";

const DEFAULT_WORDS = [
  "Torph playground",
  "Torph animates text",
  "Isn't Torph fun?",
  "Enjoy and have fun!",
];

const TEXT_ALIGNMENTS: React.CSSProperties["textAlign"][] = [
  "left",
  "center",
  "right",
];

function usePlaygroundParams() {
  const searchParams = useSearchParams();

  const wordsParam = searchParams.get("words");
  const alignParam = searchParams.get("align");

  const initialWords = wordsParam
    ? wordsParam.split("|").filter(Boolean)
    : DEFAULT_WORDS;
  const initialAlign =
    alignParam && TEXT_ALIGNMENTS.includes(alignParam as any)
      ? (alignParam as React.CSSProperties["textAlign"])
      : TEXT_ALIGNMENTS[1];

  return { initialWords, initialAlign };
}

const EXAMPLES = [
  {
    label: "Status indicator",
    words: ["Processing Action", "Action Safe", "Action Warning"],
    align: "center" as const,
  },
  {
    label: "Numbers",
    words: ["$1,234", "$5,678", "$12,345,678", "$99"],
    align: "right" as const,
  },
  {
    label: "Emoji",
    words: ["Hello 👋", "Goodbye 👋"],
    align: "left" as const,
  },
];

function updateURL(words: string[], align: string) {
  const params = new URLSearchParams();
  params.set("words", words.join("|"));
  params.set("align", align);
  window.history.replaceState(null, "", `?${params.toString()}`);
}

export const Playground = () => {
  const { initialWords, initialAlign } = usePlaygroundParams();
  const [wordIndex, setWordIndex] = React.useState(0);
  const [words, setWords] = React.useState(initialWords);
  const [textAlignment, setTextAlignment] = React.useState(initialAlign);

  React.useEffect(() => {
    updateURL(words, textAlignment!.toString());
  }, [words, textAlignment]);

  return (
    <div className={styles.testbench}>
      <Box as="div" gap={12} flexDirection="column" alignItems="stretch">
        <Box as="div" gap={4} justifyContent="flex-end">
          {EXAMPLES.map((example) => (
            <Button
              key={example.label}
              type="button"
              style={{
                display: "inline-block",
                marginRight: "0.5rem",
                marginBottom: "0.5rem",
              }}
              onClick={() => {
                setWords(example.words);
                setTextAlignment(example.align);
                setWordIndex(0);
              }}
            >
              {example.label}
            </Button>
          ))}
        </Box>

        <div
          className={styles.demo}
          style={{
            textAlign: textAlignment,
          }}
        >
          <TextMorph>{words[wordIndex]}</TextMorph>

          <div className={styles.controls}>
            <Button
              type="button"
              wide
              onClick={() => {
                setWordIndex((i) => (i + 1) % words.length);
              }}
            >
              Morph
            </Button>
          </div>
        </div>
      </Box>

      <Box
        as="div"
        flexDirection="column"
        alignItems="stretch"
        justifyContent="stretch"
        style={{ padding: "2rem 0" }}
      >
        <Box as="div" justifyContent="space-between">
          <Dropdown
            options={TEXT_ALIGNMENTS.map((alignment) => ({
              label: alignment!.toString(),
              onClick: () => setTextAlignment(alignment),
            }))}
          >
            <TextMorph>{textAlignment!.toString()}</TextMorph>
          </Dropdown>
          <Box as="div" gap={12}>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const word = formData.get("word");
                if (typeof word === "string" && word.trim() !== "") {
                  setWords((words) => [...words, word]);
                  e.currentTarget.reset();
                }
              }}
            >
              <Box as="div" gap={12}>
                <input name="word" type="text" placeholder="Add a word" />
                <Button type="submit">Add</Button>
              </Box>
            </form>
          </Box>
        </Box>
        <div className={styles.words}>
          <AnimatePresence initial={false} mode="popLayout">
            {words.map((word, i) => (
              <motion.div
                key={word}
                layout="position"
                style={{
                  display: "inline-block",
                  marginRight: "0.5rem",
                  marginBottom: "0.5rem",
                }}
                initial={{ opacity: 0, scale: 0.95, originY: 0, originX: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
              >
                <button
                  type="button"
                  disabled={words.length <= 1}
                  onClick={() => {
                    const newWords = [...words];
                    newWords.splice(i, 1);
                    setWords(newWords);
                    if (i === wordIndex) {
                      setWordIndex(0);
                    } else if (i < wordIndex) {
                      setWordIndex((prev) => prev - 1);
                    }
                  }}
                >
                  {word}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Box>
    </div>
  );
};
