import { dissolve } from "torph/plugins/dissolve";
import { Compare } from "../compare";

const PLUGINS = [dissolve()];
const VALUES = ["Signal lost", "Reconnecting", "Connected"];

export const DissolveDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
