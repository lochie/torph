import { magnet } from "torph/plugins/magnet";
import { Compare } from "../compare";

const PLUGINS = [magnet()];
// Hover the text to push its letters about.
const VALUES = ["Hover over me", "Move a little closer", "Magnetic"];

export const MagnetDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="magnet()" />
);
