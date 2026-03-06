export function parseTranslate(element: HTMLElement): {
  tx: number;
  ty: number;
} {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return { tx: 0, ty: 0 };
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return { tx: 0, ty: 0 };
  const v = match[1]!.split(",").map(Number);
  return { tx: v[4] || 0, ty: v[5] || 0 };
}

function cancelAnimations(element: HTMLElement): {
  tx: number;
  ty: number;
  opacity: number;
} {
  const { tx, ty } = parseTranslate(element);
  const opacity = Number(getComputedStyle(element).opacity) || 1;
  element.getAnimations().forEach((a) => a.cancel());
  return { tx, ty, opacity };
}

export function animateExit(
  child: HTMLElement,
  options: {
    dx: number;
    dy: number;
    duration: number;
    ease: string;
    scale: boolean;
  },
) {
  const { dx, dy, duration, ease, scale } = options;

  child.animate(
    {
      transform: scale
        ? `translate(${dx}px, ${dy}px) scale(0.95)`
        : `translate(${dx}px, ${dy}px)`,
      offset: 1,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  const fadeAnimation = child.animate(
    {
      opacity: 0,
      offset: 1,
    },
    {
      duration: duration * 0.25,
      easing: "linear",
      fill: "both",
    },
  );

  fadeAnimation.onfinish = () => child.remove();
}

export function animateEnterOrPersist(
  child: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    isNew: boolean;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, isNew, duration, ease } = options;

  const prev = cancelAnimations(child);

  const startX = deltaX + prev.tx;
  const startY = deltaY + prev.ty;

  child.animate(
    {
      transform: `translate(${startX}px, ${startY}px) scale(${isNew ? 0.95 : 1})`,
      offset: 0,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  if (isNew) {
    const startOpacity = prev.opacity < 1 ? prev.opacity : 0;
    child.animate(
      [{ opacity: startOpacity }, { opacity: 1 }],
      {
        duration: duration * 0.5,
        easing: "linear",
        fill: "both",
      },
    );
  }
}

export function transitionContainerSize(
  element: HTMLElement,
  oldWidth: number,
  oldHeight: number,
  duration: number,
  onComplete?: () => void,
) {
  if (oldWidth === 0 || oldHeight === 0) return;

  element.style.width = "auto";
  element.style.height = "auto";
  void element.offsetWidth; // force reflow

  const newWidth = element.offsetWidth;
  const newHeight = element.offsetHeight;

  element.style.width = `${oldWidth}px`;
  element.style.height = `${oldHeight}px`;
  void element.offsetWidth; // force reflow

  element.style.width = `${newWidth}px`;
  element.style.height = `${newHeight}px`;

  // TODO: move to `transitionend` event listener
  setTimeout(() => {
    element.style.width = "auto";
    element.style.height = "auto";
    onComplete?.();
  }, duration);
}
