import { mask } from "torph/plugins/mask";
import { Compare } from "../compare";

const DEFAULT = [mask()];
const LINES = [mask({ cascade: "line" })];
const LETTERS = [mask({ letters: true })];
const AUTO = [mask({ from: "auto" })];
const SIDEWAYS = [mask({ from: "right" })];
const BOUNCE = [mask({ bounce: true })];

// A word or two changes at a time, so the ones that stay hold still while the others rise.
const HERO = [
  "The wallet for\neveryday money",
  "The wallet for\neveryday savings",
  "The account for\nyour savings",
  "The account for\nyour whole family",
];
const HEADLINE = [
  "Design it.\nBuild it.\nShip it.",
  "Plan it.\nMake it.\nLaunch it.",
];
// Forward through the steps, then back one: up rises, back drops.
const STEPS = [
  "Step 1 of 4 · Cart",
  "Step 2 of 4 · Details",
  "Step 3 of 4 · Payment",
  "Step 2 of 4 · Details",
];

export const MaskDemo = () => (
  <>
    <Compare values={HERO} plugins={DEFAULT} duration={700} note="mask()" />
    <Compare
      values={HEADLINE}
      plugins={LINES}
      duration={700}
      note='mask({ cascade: "line" })'
    />
    <Compare
      values={["SIGN IN", "SIGN UP", "LOG IN"]}
      plugins={LETTERS}
      duration={700}
      note="mask({ letters: true })"
    />
    <Compare
      values={STEPS}
      plugins={AUTO}
      duration={700}
      note='mask({ from: "auto" })'
    />
    <Compare
      values={["Monday", "Tuesday", "Wednesday"]}
      plugins={SIDEWAYS}
      duration={700}
      note='mask({ from: "right" })'
    />
    <Compare
      values={["Hello", "Bonjour", "Hola", "Ciao"]}
      plugins={BOUNCE}
      duration={700}
      note="mask({ bounce: true })"
    />
  </>
);
