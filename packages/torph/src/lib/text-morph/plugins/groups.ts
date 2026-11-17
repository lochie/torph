import type { TorphPlugin } from "../plugin";
import {
  animateGroupEnter,
  animateGroupExit,
  GROUP_MIN,
} from "../utils/replace-animate";

export const groups: TorphPlugin = {
  name: "groups",
  runs: {
    claim: (run) => run.length >= GROUP_MIN,
    enter: animateGroupEnter,
    exit: animateGroupExit,
  },
};
