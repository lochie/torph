import type { TorphPlugin } from "../../lib/text-morph/plugin";
import { ghost, removeAfter } from "../ghost";

export type ShatterOptions = {
  /** How far the shards fly, in em. */
  spread?: number;
};

// Four shards that tile the box exactly, each with the way it flies.
const SHARDS = [
  { clip: "polygon(0 0, 60% 0, 35% 55%, 0 70%)", x: -1, y: -0.6, turn: -40 },
  {
    clip: "polygon(60% 0, 100% 0, 100% 45%, 35% 55%)",
    x: 1,
    y: -0.8,
    turn: 35,
  },
  {
    clip: "polygon(0 70%, 35% 55%, 55% 100%, 0 100%)",
    x: -0.7,
    y: 0.4,
    turn: 25,
  },
  {
    clip: "polygon(35% 55%, 100% 45%, 100% 100%, 55% 100%)",
    x: 0.8,
    y: 0.5,
    turn: -30,
  },
];

/** Leaving text cracks into shards that fall away; new text flies together from them. */
export function shatter({ spread = 0.5 }: ShatterOptions = {}): TorphPlugin {
  const flung = (shard: (typeof SHARDS)[number], fall: number) =>
    `translate(${shard.x * spread}em, ${shard.y * spread + fall}em) rotate(${shard.turn}deg)`;
  return {
    name: "shatter",
    key: `${spread}`,
    // Every replaced run, so groups() can't move one as a single shape in its place.
    runs: { claim: () => true },
    animate: {
      text: {
        // The shards fly in, and the box itself shows once they meet.
        enter: (box, { delta, from, duration, signal, animate }) => {
          const x = delta.x + (from?.tx ?? 0);
          const y = delta.y + (from?.ty ?? 0);
          return [
            animate(
              box,
              [{ opacity: 0 }, { opacity: 0, offset: 0.98 }, { opacity: 1 }],
              { duration },
            ),
            ...SHARDS.map((shard) => {
              const copy = ghost(box, signal);
              copy.style.clipPath = shard.clip;
              return removeAfter(
                copy,
                copy.animate(
                  [
                    {
                      transform: `translate(${x}px, ${y}px) ${flung(shard, 0)}`,
                      opacity: 0,
                    },
                    { transform: "none", opacity: 1 },
                  ],
                  { duration, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
                ),
              );
            }),
          ];
        },
        // The box goes at once; its shards fall in its place.
        exit: (box, { delta, duration, signal, animate }) => [
          animate(box, [{ opacity: 0 }, { opacity: 0 }], {
            duration,
            fill: "both",
          }),
          ...SHARDS.map((shard) => {
            const copy = ghost(box, signal);
            copy.style.clipPath = shard.clip;
            copy.style.opacity = "";
            return removeAfter(
              copy,
              copy.animate(
                [
                  { transform: "none", opacity: 1 },
                  {
                    transform: `translate(${delta.x}px, ${delta.y}px) ${flung(shard, 0.8)}`,
                    opacity: 0,
                  },
                ],
                { duration, easing: "cubic-bezier(0.4, 0, 0.9, 0.6)" },
              ),
            );
          }),
        ],
      },
    },
  };
}
