import { ripple } from "torph/plugins/ripple";
import { Compare } from "../compare";

const PLUGINS = [ripple()];
// Each change lands somewhere else in the line, so the ripple starts there.
const VALUES = ["hello world", "hello there", "well hello there"];

export const RippleDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
