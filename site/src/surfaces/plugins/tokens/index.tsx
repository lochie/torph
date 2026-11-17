import { tokens } from "torph/plugins/tokens";
import { Compare } from "../compare";

const PLUGINS = [tokens()];
const VALUES = ["src/lib/morph.ts", "src/lib/plugin.ts", "src/plugins/blur.ts"];

export const TokensDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="tokens()" />
);
