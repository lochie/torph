import { roll } from "torph/plugins/roll";
import { Compare } from "../compare";

const PLUGINS = [roll()];
const VALUES = ["Monday", "Tuesday", "Wednesday"];

export const RollDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
