import { redline } from "torph/plugins/redline";
import { Compare } from "../compare";

const PLUGINS = [redline()];
const VALUES = [
  "The quick brown fox",
  "The quick red fox jumps",
  "A quick red fox",
];

export const RedlineDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="redline()" />
);

// A function edited twice, so whole lines and single words change between versions.
const CODE = [
  `function greet(name) {
  return "Hello " + name;
}`,
  `function greet(name, greeting) {
  const text = greeting + " " + name;
  return text;
}`,
  `function greet(name, greeting = "Hi") {
  return greeting + " " + name;
}`,
];

export const RedlineCodeDemo = () => (
  <Compare values={CODE} plugins={PLUGINS} label="redline()" code />
);
