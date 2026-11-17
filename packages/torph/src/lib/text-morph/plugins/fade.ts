import type { TorphPlugin } from "../plugin";
import { animateEnterOrPersist, animateExit } from "../utils/animate";

const FADE: TorphPlugin = {
  name: "fade",
  animate: {
    text: {
      enter: (box, { delta, from, duration, ease }) =>
        animateEnterOrPersist(box, {
          deltaX: delta.x,
          deltaY: delta.y,
          isNew: true,
          previous: from,
          duration,
          ease,
        }),
      exit: (box, { delta, duration, ease }) =>
        animateExit(box, { dx: delta.x, dy: delta.y, duration, ease }),
    },
  },
};

/** Text fades in where it lands and fades out where it leaves, sliding with its neighbours. */
export const fade = () => FADE;
