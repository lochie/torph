import { wave } from "torph/plugins/wave";
import { Compare } from "../compare";

const PLUGINS = [wave()];
const VALUES = ["Hello", "Howdy", "Hi there"];

export const WaveDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
