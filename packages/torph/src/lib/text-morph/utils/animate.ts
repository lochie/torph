import {
  type AnimationState,
  cancelAnimations,
  fadeTiming,
} from "../../utils/animate";

export function animateExit(
  child: HTMLElement,
  options: {
    dx: number;
    dy: number;
    duration: number;
    ease: string;
    scale: boolean;
    steady?: boolean;
  },
) {
  const { dx, dy, duration, ease, scale, steady } = options;

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
    fadeTiming(duration, ease, steady, 0.25),
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
    steady?: boolean;
    previous?: AnimationState;
  },
) {
  const { deltaX, deltaY, isNew, duration, ease, steady } = options;

  const prev = cancelAnimations(child, options.previous);

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
    child.animate(
      [{ opacity: startOpacity }, { opacity: 1 }],
      fadeTiming(duration, ease, steady, isNew ? 0.5 : 0.25, isNew ? 0.25 : 0),
    );
  }
}
