import type { TorphPlugin } from "../../lib/text-morph/plugin";

/** One display string per character: a space as the engine draws it, a newline as a break. */
const characters = (value: string) =>
  Array.from(value, (char) => (char === " " ? " " : char));

/** Every letter is reused wherever the new value needs it, across words and in any order. */
export function anagram(): TorphPlugin {
  return {
    name: "anagram",
    whole: (value, { previous, id }) => {
      // Letters still on screen, by letter, case aside: each can be taken once.
      const pool = new Map<string, string[]>();
      for (const segment of previous) {
        if (Array.from(segment.string).length !== 1) continue;
        const key = segment.string.toLowerCase();
        pool.set(key, [...(pool.get(key) ?? []), segment.id]);
      }
      return characters(value).map((string) => ({
        id: pool.get(string.toLowerCase())?.shift() ?? id(),
        string,
      }));
    },
    // Kept letter by letter, however much of the value changes.
    runs: { claim: () => true },
  };
}
