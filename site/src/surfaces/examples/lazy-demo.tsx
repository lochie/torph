import React from "react";
import type { ComponentType } from "react";

import { useInView } from "@/hooks/useInView";
import styles from "./styles.module.scss";

// A screen ahead, so a demo is already running by the time it is read.
const MARGIN = "100% 0px";

/**
 * Demos drive themselves on intervals and rAF loops, and every tick is a morph
 * that forces layout. Unmounting the offscreen ones stops the driver, which is
 * the only thing that stops the morph — 65 at once is what makes the page crawl.
 */
export const LazyDemo = ({ Component }: { Component: ComponentType }) => {
  const [ref, inView] = useInView<HTMLDivElement>(MARGIN);
  const height = React.useRef(0);

  // Held imperatively: through `style` it would be a render read of the ref, and
  // through state a re-render on every frame a demo changes size.
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!inView) {
      node.style.height = height.current ? `${height.current}px` : "";
      return;
    }

    node.style.height = "";
    const observer = new ResizeObserver(() => {
      height.current = node.offsetHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, inView]);

  return (
    <div ref={ref} className={styles.preview}>
      {inView ? <Component /> : null}
    </div>
  );
};
