import { smoke } from "torph/plugins/smoke";
import { Compare } from "../compare";

const PLUGINS = [smoke()];
const VALUES = ["Incense", "Campfire", "Extinguished"];

export const SmokeDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
