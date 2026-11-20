import React from "react";
import { trend } from "torph/plugins/trend";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Live } from "../compare";

const PLUGINS = [trend()];
const START = 128_420; // cents
const TICK = 1600;

const price = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export const TrendDemo = () => {
  const [cents, setCents] = React.useState(START);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(
      // A walk that leans back to where it started, so it never drifts off.
      () =>
        setCents((c) =>
          Math.round(c + (Math.random() - 0.5) * 900 + (START - c) * 0.1),
        ),
      TICK,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return <Live value={price(cents)} plugins={PLUGINS} />;
};
