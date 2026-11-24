import { blur } from "torph/plugins/blur";
import { Compare } from "../compare";

// Module-level, so every render hands the morph the same plugin.
const PLUGINS = [blur()];
// "Transaction" moves to the front while the words around it blur in and out.
const VALUES = ["Processing Transaction", "Transaction Safe"];

export const BlurDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
