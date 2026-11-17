import type { TorphPlugin } from "../plugin";
import {
  animateGroupEnter,
  animateGroupExit,
  GROUP_MIN,
} from "../utils/replace-animate";

const GROUPS: TorphPlugin = {
  name: "groups",
  runs: {
    claim: (run) => run.length >= GROUP_MIN,
    enter: animateGroupEnter,
    exit: animateGroupExit,
  },
};

/** A long run of text replaced whole recedes and arrives as one shape, rather than letter by letter. */
export const groups = () => GROUPS;
