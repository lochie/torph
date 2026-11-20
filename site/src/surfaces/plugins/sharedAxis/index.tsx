import { sharedAxis } from "torph/plugins/sharedAxis";
import { Compare } from "../compare";

const ALONG = [sharedAxis()];
const DEPTH = [sharedAxis({ axis: "z" })];
// Forward through the steps, then back one, so both directions show.
const STEPS = [
  "Step 1 of 3 · Account",
  "Step 2 of 3 · Profile",
  "Step 3 of 3 · Review",
  "Step 2 of 3 · Profile",
];
const PAGES = ["Overview", "Details", "Settings"];

export const SharedAxisDemo = () => (
  <>
    <Compare values={STEPS} plugins={ALONG} note="sharedAxis()" />
    <Compare values={PAGES} plugins={DEPTH} note='sharedAxis({ axis: "z" })' />
  </>
);
