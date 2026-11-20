import type { TorphPlugin } from "../plugin";
import { ARRIVE } from "../../utils/animate";

const SMALL = "0.95";

// The `scale` property, not an additive `transform`: it rides on whatever moves the box, and Chrome can't composite an additive animation, so text redrawn each frame squishes.
const SCALE: TorphPlugin = {
  name: "scale",
  decorate: {
    text: {
      // A run that moves as one shape scales as one already.
      enter: (box, { duration, ease, run }) =>
        run
          ? undefined
          : [
              box.animate([{ scale: SMALL }, { scale: "1" }], {
                duration,
                easing: ease,
                fill: ARRIVE,
              }),
            ],
      exit: (box, { duration, ease, run }) =>
        run
          ? undefined
          : [
              box.animate(
                { scale: SMALL, offset: 1 },
                { duration, easing: ease, fill: "both" },
              ),
            ],
    },
  },
};

/** Text grows a little as it arrives and shrinks a little as it leaves, alongside whatever moves it. */
export const scale = () => SCALE;
