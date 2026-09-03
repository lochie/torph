import React from "react";

// Where the mascot is allowed to sit. Any component can declare itself one; he
// reads the set every few frames and floats to whichever is nearest the pointer.

// A corner sits him on the box at one end of that edge, rather than over it.
export type MascotSide =
  | "on"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type MascotSpot = {
  el: HTMLElement;
  side: MascotSide;
  gap: number;
  pull: number;
  says: string[];
};

export type MascotSpotOptions = Partial<Omit<MascotSpot, "el" | "says">> & {
  /** What he has to say about it. Several lines and a tap moves him on to the next. */
  says?: string | string[];
};

const DEFAULTS = { side: "top" as MascotSide, gap: 12, pull: 0 };

const spots = new Set<MascotSpot>();

export const mascotSpots = () => spots;

/**
 * `side` is where he perches relative to the element, `gap` the px he stands off
 * it, and `pull` the px of advantage the spot carries over its rivals.
 */
export const useMascotSpot = <T extends HTMLElement>({
  side = DEFAULTS.side,
  gap = DEFAULTS.gap,
  pull = DEFAULTS.pull,
  says,
}: MascotSpotOptions = {}) => {
  const ref = React.useRef<T>(null);
  const entry = React.useRef<MascotSpot | null>(null);

  // The lines join into one dep: an array literal at the call site is a new array
  // every render, and re-registering would send him home on every keystroke.
  const script = typeof says === "string" ? says : (says ?? []).join("\n");

  // Registered once per element, then updated in place. A spot whose lines change
  // while he reads them out — the 404 narrates a repair — must not re-register.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const spot: MascotSpot = { el, ...DEFAULTS, says: [] };
    entry.current = spot;
    spots.add(spot);

    return () => {
      spots.delete(spot);
      entry.current = null;
    };
  }, []);

  React.useEffect(() => {
    const spot = entry.current;
    if (!spot) return;

    spot.side = side;
    spot.gap = gap;
    spot.pull = pull;
    spot.says = script ? script.split("\n") : [];
  }, [side, gap, pull, script]);

  return ref;
};
