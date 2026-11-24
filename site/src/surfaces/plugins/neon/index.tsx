import { neon } from "torph/plugins/neon";
import { Compare } from "../compare";

const PLUGINS = [neon()];
const VALUES = ["OPEN", "CLOSED", "OPEN LATE"];

export const NeonDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
