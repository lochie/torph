import { skeleton } from "torph/plugins/skeleton";
import { Compare } from "../compare";

const PLUGINS = [skeleton()];
// Empty is loading: the bar holds the place until a name arrives.
const VALUES = ["", "Ada Lovelace", "", "Grace Hopper"];

export const SkeletonDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="skeleton()" />
);
