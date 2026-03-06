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

  child.getAnimations().forEach((a) => a.cancel());

  child.animate(
    {
      transform: `translate(${deltaX}px, ${deltaY}px) scale(${isNew ? 0.95 : 1})`,
      offset: 0,
    },
    {
      duration,
      easing: ease,
      fill: "both",
    },
  );

  const fadeDuration = isNew ? duration * 0.25 : 0;
  const fadeDelay = isNew ? duration * 0.25 : 0;

  child.animate(
    {
      opacity: isNew ? 0 : 1,
      offset: 0,
    },
    {
      duration: fadeDuration,
      delay: fadeDelay,
      easing: "linear",
      fill: "both",
    },
  );
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
