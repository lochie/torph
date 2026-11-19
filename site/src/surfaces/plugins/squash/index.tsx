import { squash } from "torph/plugins/squash";
import { Compare } from "../compare";

const PLUGINS = [squash()];
// Words that trade places, so letters hop across; and some that come and go.
const VALUES = [
  "Red Green Blue",
  "Blue Red Green",
  "Green Blue",
  "Red Green Blue",
];

export const SquashDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} duration={700} />
);
