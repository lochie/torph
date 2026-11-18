import { stack } from "torph/plugins/stack";
import { Compare } from "../compare";

const PLUGINS = [stack()];
const VALUES = ["Uploading 3 files", "Processing", "Uploaded"];

export const StackDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
