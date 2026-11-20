import { lookalike } from "torph/plugins/lookalike";
import { Compare } from "../compare";

// Slower steps, so each glyph on the way can be read.
const PLUGINS = [lookalike({ rate: 80 })];
// Leetspeak: every changed letter has a lookalike to pass through.
const VALUES = ["HACKER", "H4CK3R", "HAXOR", "H4X0R", "LEET", "1337"];

export const LookalikeDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} mono duration={600} />
);
