import type { TorphPlugin } from "../plugin";
import { ARRIVE } from "../../utils/animate";

const SMALL = "scale(0.95)";

// `add`, so it rides on whatever moves the box rather than replacing its transform.
const SCALE: TorphPlugin = {
  name: "scale",
  decorate: {
    text: {
      // A run that moves as one shape scales as one already.
      enter: (box, { duration, ease, run }) =>
        run
          ? undefined
          : [
              box.animate([{ transform: SMALL }, { transform: "none" }], {
                duration,
                easing: ease,
                fill: ARRIVE,
                composite: "add",
              }),
            ],
      exit: (box, { duration, ease, run }) =>
        run
          ? undefined
          : [
              box.animate(
                { transform: SMALL, offset: 1 },
                { duration, easing: ease, fill: "both", composite: "add" },
              ),
            ],
    },
  },
};

/** Text grows a little as it arrives and shrinks a little as it leaves, alongside whatever moves it. */
export const scale = () => SCALE;
