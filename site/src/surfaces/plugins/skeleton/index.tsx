import React from "react";
import { blur } from "torph/plugins/blur";
import { skeleton } from "torph/plugins/skeleton";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { wrap } from "@/surfaces/demos/wrap";
import { Compare, Live } from "../compare";

const PLUGINS = [skeleton()];
// Empty is loading: the bar holds the place until a name arrives.
const VALUES = ["", "Ada Lovelace", "", "Grace Hopper"];

export const SkeletonDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} label="skeleton()" />
);

const REPLY =
  "Canberra is the capital of Australia. It was chosen in 1908 as a compromise between Sydney and Melbourne, and designed around a lake.";
const WORDS = REPLY.split(" ");
const THINKING = 1400; // ms the bar holds before the first word
const WORD = 110;
const HOLD = 2600; // Beat on the finished reply before it asks again

const REPLY_PLUGINS = [skeleton({ length: 18 }), blur()];

// Empty while it thinks, then a word at a time: the bar gives way to text that blurs in as it streams.
export const StreamingReplyDemo = () => {
  const [count, setCount] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const done = count >= WORDS.length;
    const timer = window.setTimeout(
      () => setCount((n) => (done ? 0 : n + 1)),
      done ? HOLD : count === 0 ? THINKING : WORD,
    );
    return () => window.clearTimeout(timer);
  }, [count, reducedMotion]);

  const shown = reducedMotion ? WORDS.length : count;
  return (
    <Live
      value={wrap(WORDS.slice(0, shown).join(" "), 34)}
      plugins={REPLY_PLUGINS}
      label="skeleton() + blur()"
      code
    />
  );
};
