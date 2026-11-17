import type { TorphPlugin } from "../../lib/text-morph/plugin";

/** A changed word swaps whole, instead of morphing the letters it shares. */
export function words(): TorphPlugin {
  return {
    name: "words",
    claim: () => true,
    segment: (word, { id }) => [{ id: id(word), string: word }],
  };
}
