import { ticker } from "torph/plugins/ticker";
import { Compare } from "../compare";

const PLUGINS = [ticker()];
const VALUES = ["Connecting", "Connected", "Syncing", "Synced"];

export const TickerDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
