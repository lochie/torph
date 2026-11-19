import { cascade } from "torph/plugins/cascade";
import { Compare } from "../compare";

const PLUGINS = [cascade()];
const VALUES = [
  "Design it.\nBuild it.\nShip it.",
  "Plan it.\nMake it.\nLaunch it.",
  "Dream it.\nDraw it.\nShare it.",
];

export const CascadeDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} duration={700} />
);
