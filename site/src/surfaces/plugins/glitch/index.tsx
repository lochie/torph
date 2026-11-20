import { glitch } from "torph/plugins/glitch";
import { Compare } from "../compare";

const PLUGINS = [glitch()];
const VALUES = ["SYSTEM ONLINE", "SIGNAL LOST", "REBOOTING"];

export const GlitchDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
