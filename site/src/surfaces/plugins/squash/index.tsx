import { squash } from "torph/plugins/squash";
import { Compare } from "../compare";

const PLUGINS = [squash()];
// The words trade places, so each travels far enough to stretch.
const VALUES = ["Red Green Blue", "Blue Red Green", "Green Blue Red"];

export const SquashDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="squash()" duration={600} />
);
