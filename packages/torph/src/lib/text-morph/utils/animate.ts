import { cancelAnimations, fadeDuration } from "../../utils/animate";

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
      duration: fadeDuration(duration, 0.25),
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
  const startOpacity = isNew && prev.opacity >= 1 ? 0 : prev.opacity;

  child.animate(
    [
      {
        transform: `translate(${startX}px, ${startY}px) scale(${isNew ? 0.95 : 1})`,
      },
      { transform: "none" },
    ],
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  if (startOpacity < 1) {
    child.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: fadeDuration(duration, isNew ? 0.5 : 0.25),
      delay: isNew ? fadeDuration(duration, 0.25) : 0,
      easing: "linear",
      fill: "both",
    });
  }
}
