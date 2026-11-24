import { slot } from "torph/plugins/slot";
import { words } from "torph/plugins/words";
import { Compare } from "../compare";

// With words(), a changed word rolls whole rather than letter by letter.
const PLUGINS = [slot(), words()];
const VALUES = ["Status: Online", "Status: Away", "Status: Busy"];

export const SlotDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
