import { cancelAnimations } from "../../utils/animate";

/**
 * How much of a run has to be replaced before it stops being characters moving
 * and starts being one thing swapped for another.
 *
 * Under it, the individual characters still read as themselves and their
 * entrances carry meaning. Over it, nothing that survived is nearby, so every
 * character animates from a position the value never held — which is the smear
 * you get pushing a currency figure up to millions, or the middle nine letters
 * of a word being replaced by eight different ones. Once that many characters
 * are going at once, the honest gesture is one gesture.
 */
export const GROUP_MIN = 6;

/**
 * How far a replaced run collapses towards its own centre.
 *
 * Deeper than the 0.95 an individual character uses, because this has to read
 * as the run receding rather than as a glyph settling.
 */
const GROUP_SCALE = 0.8;

const EXIT_FADE = 0.45;
const ENTER_FADE = 0.35;

/**
 * The centre of a run, in the coordinate space of each of its members.
 *
 * Scaling a group as one shape means every member scaling about the same point,
 * and `transform-origin` is per element — so the shared point has to be
 * restated relative to each of their boxes.
 */
function originsFor(elements: HTMLElement[]): string[] {
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
  options: { duration: number; ease: string },
) {
  const { duration, ease } = options;
  const origins = originsFor(elements);

  elements.forEach((element, i) => {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.style.transformOrigin = origins[i]!;

    element.animate(
      { transform: `scale(${GROUP_SCALE})`, offset: 1 },
      { duration, easing: ease, fill: "both" },
    );

    const fade = element.animate(
      { opacity: 0, offset: 1 },
      { duration: duration * EXIT_FADE, easing: "linear", fill: "both" },
    );
    fade.onfinish = () => element.remove();
  });
}

/** The same gesture in reverse, for the run arriving in its place. */
export function animateGroupEnter(
  elements: HTMLElement[],
  options: { duration: number; ease: string },
) {
  const { duration, ease } = options;
  const origins = originsFor(elements);

  elements.forEach((element, i) => {
    const prev = cancelAnimations(element);
    element.style.transformOrigin = origins[i]!;

    element.animate(
      { transform: `scale(${GROUP_SCALE})`, offset: 0 },
      { duration, easing: ease, fill: "both" },
    );

    const startOpacity = prev.opacity >= 1 ? 0 : prev.opacity;
    element.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      duration: duration * ENTER_FADE,
      easing: "linear",
      fill: "both",
    });
  });
}

/**
 * Maximal stretches of `members` that are adjacent in `all`, long enough to be
 * worth replacing as a unit. A run broken by anything that survived is not a
 * replacement — the survivor is right there to move relative to.
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
