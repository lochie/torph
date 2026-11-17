import { reveal } from "torph/plugins/reveal";
import { Compare } from "../compare";

const PLUGINS = [reveal()];
// The last four stay put; every other place turns over.
const VALUES = ["•••• •••• •••• 4242", "4929 1038 5521 4242"];

export const RevealDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="reveal()" mono />
);
