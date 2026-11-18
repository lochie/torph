import React from "react";
import { odometer } from "torph/plugins/odometer";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Compare, Live } from "../compare";

const PLUGINS = [odometer()];
// Each change carries through a different number of places.
const VALUES = ["$1,299", "$1,300", "$1,450", "$998"];

export const OdometerDemo = () => (
  <Compare values={VALUES} plugins={PLUGINS} duration={700} />
);

const FROM = 5 * 60;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (seconds: number) =>
  `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

// A second at a time: the ones wheel turns every tick, the minutes only at the top of one.
export const CountdownDemo = () => {
  const [left, setLeft] = React.useState(FROM);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(
      () => setLeft((s) => (s === 0 ? FROM : s - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return <Live value={clock(left)} plugins={PLUGINS} duration={600} mono />;
};
