import { countup } from "torph/plugins/countup";
import { Compare } from "../compare";

const PLUGINS = [countup()];
// Big jumps either way, so the count has somewhere to go.
const VALUES = ["$0", "$1,284", "$12,950", "$480"];

export const CountupDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="countup()" />
);
