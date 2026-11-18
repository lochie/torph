import { caseless } from "torph/plugins/caseless";
import { Compare } from "../compare";

const PLUGINS = [caseless()];
// Only the case changes, so every letter keeps its box.
const VALUES = ["hello world", "Hello World", "HELLO WORLD"];

export const CaselessDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
