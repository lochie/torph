import { odometer } from "torph/plugins/odometer";
import { Compare } from "../compare";

const PLUGINS = [odometer()];
// Each change carries through a different number of places.
const VALUES = ["$1,299", "$1,300", "$1,450", "$998"];

export const OdometerDemo = () => (
  <Compare
    values={VALUES}
    plugins={PLUGINS}
    label="odometer()"
    duration={700}
  />
);
