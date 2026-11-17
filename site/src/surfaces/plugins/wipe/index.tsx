import { wipe } from "torph/plugins/wipe";
import { Compare } from "../compare";

const PLUGINS = [wipe()];
const VALUES = ["Draft", "In review", "Published"];

export const WipeDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="wipe()" duration={700} />
);
