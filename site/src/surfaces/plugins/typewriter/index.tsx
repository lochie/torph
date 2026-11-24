import { typewriter } from "torph/plugins/typewriter";
import { Compare } from "../compare";

const PLUGINS = [typewriter()];
const VALUES = ["Hello", "Hello world", "Goodbye world"];

export const TypewriterDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} />
);
