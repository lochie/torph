import {
  type AnimationState,
  cancelAnimations,
  fadeTiming,
} from "../../utils/animate";

// Where characters moving becomes one thing swapped for another. Past this, nothing
// that survived is near enough to animate from, and the run smears.
export const GROUP_MIN = 6;

// Deeper than a character's 0.95, so the run reads as receding, not as a glyph settling.
const GROUP_SCALE = 0.8;

const EXIT_FADE = 0.45;
const ENTER_FADE = 0.35;

/** A run's centre, restated per member — `transform-origin` is relative to each box. */
export function originsFor(elements: HTMLElement[]): string[] {
  const rects = elements.map((element) => element.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const centreX = (left + right) / 2;
  const centreY = (top + bottom) / 2;

  return rects.map((r) => `${centreX - r.left}px ${centreY - r.top}px`);
}

/** Collapses a wholly-replaced run towards its own centre and fades it out. */
export function animateGroupExit(
  elements: HTMLElement[],
  options: {
    duration: number;
    ease: string;
    steady?: boolean;
    origins?: string[];
  },
) {
  const { duration, ease, steady } = options;
  const origins = options.origins ?? originsFor(elements);

  // Nothing to cancel: leaving the flow already stopped whatever these were riding.
  elements.forEach((element, i) => {
    element.style.transformOrigin = origins[i]!;

    element.animate(
      { transform: `scale(${GROUP_SCALE})`, offset: 1 },
      { duration, easing: ease, fill: "both" },
    );

    const fade = element.animate(
      { opacity: 0, offset: 1 },
      fadeTiming(duration, ease, steady, EXIT_FADE),
    );
    fade.onfinish = () => element.remove();
  });
}

/** The same gesture in reverse, for the run arriving in its place. */
export function animateGroupEnter(
  elements: HTMLElement[],
  options: {
    duration: number;
    ease: string;
    steady?: boolean;
    origins?: string[];
    previous?: AnimationState[];
  },
) {
  const { duration, ease, steady } = options;
  const origins = options.origins ?? originsFor(elements);

  elements.forEach((element, i) => {
    const prev = cancelAnimations(element, options.previous?.[i]);
    element.style.transformOrigin = origins[i]!;

    element.animate(
      { transform: `scale(${GROUP_SCALE})`, offset: 0 },
      { duration, easing: ease, fill: "both" },
    );

    const startOpacity = prev.opacity >= 1 ? 0 : prev.opacity;
    element.animate(
      [{ opacity: startOpacity }, { opacity: 1 }],
      fadeTiming(duration, ease, steady, ENTER_FADE),
    );
  });
}

/**
 * Maximal stretches of `members` adjacent in `all`. A run broken by a survivor is no
 * replacement — that survivor is right there to move relative to.
 */
export function replacedRuns(
  all: HTMLElement[],
  members: Set<HTMLElement>,
): HTMLElement[][] {
  const runs: HTMLElement[][] = [];
  let run: HTMLElement[] = [];

  const flush = () => {
    if (run.length >= GROUP_MIN) runs.push(run);
    run = [];
  };

  for (const element of all) {
    if (members.has(element)) run.push(element);
    else flush();
  }
  flush();

  return runs;
}
