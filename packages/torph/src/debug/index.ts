import { guarded } from "./guard";
import { DEBUG_GUARD } from "../lib/utils/constants";

/** Warns, on instances with `debug` on, when a plugin hook reads layout. */
export function enableDebug() {
  (globalThis as Record<symbol, unknown>)[DEBUG_GUARD] = guarded;
}
