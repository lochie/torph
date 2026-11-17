import { weight } from "torph/plugins/weight";
import { Compare } from "../compare";

const PLUGINS = [weight()];
// Inter is a variable font, so its weight can animate.
const VALUES = ["Draft", "Drafted", "Shipped"];

export const WeightDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="weight()" duration={600} />
);
