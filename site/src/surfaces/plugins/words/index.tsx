import { words } from "torph/plugins/words";
import { Compare } from "../compare";

const PLUGINS = [words()];
// Each day shares enough letters with the last for torph to morph them; words() swaps it whole.
const VALUES = [
  "Ship it Monday",
  "Ship it Tuesday",
  "Ship it Thursday",
  "Ship it Sunday",
];

export const WordsDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="words()" />
);
