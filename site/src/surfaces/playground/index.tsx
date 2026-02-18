"use client";

import styles from "./styles.module.scss";

import React from "react";
import { TextMorph } from "torph/react";
import { Button } from "@/components/button";
import { Box } from "@/components/box";
import { Dropdown } from "@/components/dropdown";
import { generate } from "random-words";
import { AnimatePresence, motion } from "motion/react";

const TEXT_ALIGNMENTS: React.CSSProperties["textAlign"][] = [
  "left",
  "center",
  "right",
];

export const Playground = () => {
  const [wordIndex, setWordIndex] = React.useState(0);
  const [words, setWords] = React.useState([
    "Torph playground",
    "Torph animates text",
    "Isn't Torph fun?",
    "Enjoy and have fun!",
  ]);
  const [textAlignment, setTextAlignment] = React.useState(TEXT_ALIGNMENTS[1]);

  return (
    <div className={styles.testbench}>
      <div
        className={styles.demo}
        style={{
          textAlign: textAlignment,
        }}
      >
        <TextMorph>{words[wordIndex]}</TextMorph>
      </div>

      <Box
        as="div"
        flexDirection="column"
        alignItems="stretch"
        justifyContent="stretch"
        style={{ padding: "2rem 0" }}
      >
        <Box as="div" justifyContent="space-between">
          Words
          <Box as="div" gap={12}>
            <form
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
        <div>
          <Button
            type="button"
            onClick={() => {
              const newWords = [...words, (generate(2) as string[]).join(" ")];
              setWords(newWords);
            }}
            style={{
              display: "inline-block",
              marginRight: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            Random
          </Button>
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
                <Button
                  type="button"
                  disabled={i === wordIndex}
                  onClick={() => {
                    const newWords = [...words];
                    newWords.splice(i, 1);
                    setWords(newWords);
                  }}
                >
                  {word}
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <Box as="div">
          Text Alignment
          <Dropdown
            options={TEXT_ALIGNMENTS.map((alignment) => ({
              label: alignment!.toString(),
              onClick: () => setTextAlignment(alignment),
            }))}
          >
            <TextMorph>{textAlignment!.toString()}</TextMorph>
          </Dropdown>
        </Box>
      </Box>

      <Box as="div">
        <Button
          type="button"
          wide
          onClick={() => {
            setWordIndex((i) => (i + 1) % words.length);
          }}
        >
          Morph
        </Button>
      </Box>
    </div>
  );
};
