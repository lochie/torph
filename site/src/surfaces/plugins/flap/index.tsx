import { flap } from "torph/plugins/flap";
import { Compare } from "../compare";

const PLUGINS = [flap()];
// Slow enough to read the drum turn; monospace, like a real board.
const VALUES = ["DEPARTING", "BOARDING", "DELAYED", "ON TIME"];

export const FlapDemo = () => (
  <Compare
    values={VALUES}
    plugins={PLUGINS}
    label="flap()"
    duration={900}
    mono
  />
);
