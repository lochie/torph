import { fadeThrough } from "torph/plugins/fadeThrough";
import { Compare } from "../compare";

const PLUGINS = [fadeThrough()];
const VALUES = ["Inbox", "Drafts", "Sent", "Archive"];

export const FadeThroughDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} />
);
