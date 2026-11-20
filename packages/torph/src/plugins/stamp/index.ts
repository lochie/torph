import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type StampOptions = {
  /** How much bigger new text starts, before it lands. */
  lift?: number;
};

type State = { shaken: boolean };

// The share of the morph at which new text lands.
const IMPACT = 0.45;

/** New text slams down like a rubber stamp, and the line shudders when it lands. */
export function stamp({ lift = 1.8 }: StampOptions = {}): TorphPlugin<State> {
  /** The whole line shakes once per morph, at the moment of impact. */
  const shake = (box: HTMLElement, state: State, duration: number) => {
    if (state.shaken) return [];
    state.shaken = true;
    const root = box.closest<HTMLElement>("[torph-root]");
    if (!root) return [];
    return [
      root.animate(
        [
          { transform: "none" },
          { transform: "translate(0, 0.05em)" },
          { transform: "translate(-0.02em, -0.02em)" },
          { transform: "translate(0.01em, 0.01em)" },
          { transform: "none" },
        ],
        {
          duration: duration * 0.4,
          delay: duration * IMPACT,
          composite: "add",
        },
      ),
    ];
  };
  return {
    name: "stamp",
    key: `${lift}`,
    read: () => ({ shaken: false }),
    idle: { shaken: false },
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        enter: (box, { delta, from, duration, state, animate }) => [
          animate(
            box,
            [
              {
                transform: `translate(${delta.x + (from?.tx ?? 0)}px, ${delta.y + (from?.ty ?? 0)}px) scale(${lift})`,
                opacity: 0,
                easing: "cubic-bezier(0.6, 0, 0.9, 0.5)",
              },
              { transform: "scale(0.92)", opacity: 1, offset: IMPACT },
              { transform: "none" },
            ],
            { duration, fill: "backwards" },
          ),
          ...shake(box, state, duration),
        ],
        exit: (box, { delta, duration, animate }) => [
          animate(
            box,
            {
              transform: `translate(${delta.x}px, ${delta.y}px) scale(1.15)`,
              opacity: 0,
              offset: 1,
            },
            { duration: duration * 0.35, easing: "ease-out", fill: "both" },
          ),
        ],
      },
    },
  };
}
