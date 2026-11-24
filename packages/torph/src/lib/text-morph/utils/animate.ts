import type { AnimationState } from "../../utils/animate";
import { ARRIVE, cancelAnimations, fadeDuration } from "../../utils/animate";

export function animateExit(
  child: HTMLElement,
  options: {
    dx: number;
    dy: number;
    duration: number;
    ease: string;
  },
) {
  const { dx, dy, duration, ease } = options;

  const slide = child.animate(
    {
      transform: `translate(${dx}px, ${dy}px)`,
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
  return [slide, fadeAnimation];
}

export function animateEnterOrPersist(
  child: HTMLElement,
  options: {
    deltaX: number;
    deltaY: number;
    isNew: boolean;
    previous?: AnimationState;
    duration: number;
    ease: string;
  },
) {
  const { deltaX, deltaY, isNew, duration, ease } = options;

  const prev = cancelAnimations(child, options.previous);

  const startX = deltaX + prev.tx;
  const startY = deltaY + prev.ty;
  const startOpacity = isNew && prev.opacity >= 1 ? 0 : prev.opacity;

  if (!isNew && startX === 0 && startY === 0 && startOpacity === 1) return [];

  const motion = [
    child.animate(
      [
        {
          transform: `translate(${startX}px, ${startY}px)`,
        },
        { transform: "none" },
      ],
      {
        duration,
        easing: ease,
        fill: ARRIVE,
      },
    ),
  ];

  if (startOpacity < 1) {
    motion.push(
      child.animate([{ opacity: startOpacity }, { opacity: 1 }], {
        duration: fadeDuration(duration, isNew ? 0.5 : 0.25),
        delay: isNew ? fadeDuration(duration, 0.25) : 0,
        easing: "linear",
        fill: ARRIVE,
      }),
    );
  }
  return motion;
}
