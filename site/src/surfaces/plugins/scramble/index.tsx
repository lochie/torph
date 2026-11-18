import { scramble } from "torph/plugins/scramble";
import { Compare } from "../compare";

const PLUGINS = [scramble()];
const VALUES = ["Connecting", "Connected", "Signal lost"];

export const ScrambleDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} duration={700} />
);
