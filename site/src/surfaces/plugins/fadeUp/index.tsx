import { fadeUp } from "torph/plugins/fadeUp";
import { Compare } from "../compare";

const PLUGINS = [fadeUp()];
const VALUES = ["Welcome back", "Welcome back, Sam", "Good to see you, Sam"];

export const FadeUpDemo = () => <Compare values={VALUES} plugins={PLUGINS} />;
