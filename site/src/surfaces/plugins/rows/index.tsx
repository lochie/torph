import { rows } from "torph/plugins/rows";
import { Compare } from "../compare";

// Known by name, so a row keeps its box while its score changes and it climbs.
const PLUGINS = [rows({ key: (line) => line.split(" ")[0]! })];

const STANDINGS: [string, number][][] = [
  [
    ["Ada", 2140],
    ["Grace", 1980],
    ["Katherine", 1720],
    ["Margaret", 1505],
  ],
  [
    ["Katherine", 2290],
    ["Ada", 2140],
    ["Grace", 2010],
    ["Margaret", 1505],
  ],
  [
    ["Katherine", 2290],
    ["Margaret", 2275],
    ["Ada", 2160],
    ["Grace", 2010],
  ],
  [
    ["Grace", 2420],
    ["Katherine", 2290],
    ["Margaret", 2275],
    ["Ada", 2160],
  ],
];

const VALUES = STANDINGS.map((standing) =>
  standing
    .map(
      ([name, score]) =>
        `${name.padEnd(10)}${score.toLocaleString("en-US").padStart(6)}`,
    )
    .join("\n"),
);

export const RowsDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="rows()" code />
);
