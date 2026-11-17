import { anagram } from "torph/plugins/anagram";
import { Compare } from "../compare";

const PLUGINS = [anagram()];
// Each pair is made of the same letters, so every letter travels.
const VALUES = ["dormitory", "dirty room", "the eyes", "they see"];

export const AnagramDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="anagram()" duration={700} />
);
