import type { AnyPlugin } from "../plugin";
import { groups } from "./groups";
import { numbers } from "./numbers";

const BUILT_IN: readonly AnyPlugin[] = [numbers, groups];
const WITHOUT_NUMBERS: readonly AnyPlugin[] = [groups];

/** The public `numbers` flag, as a plugin list, after any of the author's own. */
export function pluginsFor(
  numbersOn: boolean | undefined,
  own: readonly AnyPlugin[] = [],
) {
  const builtIn = numbersOn === false ? WITHOUT_NUMBERS : BUILT_IN;
  return own.length ? [...own, ...builtIn] : builtIn;
}
