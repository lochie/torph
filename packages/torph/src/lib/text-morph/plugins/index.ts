import type { AnyPlugin } from "../plugin";
import { fade } from "./fade";
import { groups } from "./groups";
import { numbers } from "./numbers";
import { scale } from "./scale";

export { fade, groups, numbers, scale };

// Built once: every instance without `plugins` shares it, so wrappers see the same set each render.
export const CLASSIC: readonly AnyPlugin[] = [
  numbers(),
  groups(),
  fade(),
  scale(),
];

/** torph's own look, used when `plugins` isn't set: numbers, grouped replacements, a fade and a scale. */
export const classic = (): AnyPlugin[] => [...CLASSIC];
