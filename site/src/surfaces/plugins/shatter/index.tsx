import { shatter } from "torph/plugins/shatter";
import { Compare } from "../compare";

const PLUGINS = [shatter()];
const VALUES = ["Glass", "Broken", "Repaired"];

export const ShatterDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
