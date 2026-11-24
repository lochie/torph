import { stamp } from "torph/plugins/stamp";
import { words } from "torph/plugins/words";
import { Compare } from "../compare";

// With words(), each word lands whole, as a stamp would.
const PLUGINS = [stamp(), words()];
// A word added each time, so each lands on the line that's already there.
const VALUES = [
  "Draft",
  "Draft Reviewed",
  "Draft Reviewed Approved",
  "Reviewed Approved Paid",
];

export const StampDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
