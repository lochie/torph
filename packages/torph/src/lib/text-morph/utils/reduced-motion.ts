export type ReducedMotionState = {
  readonly prefersReducedMotion: boolean;
  destroy: () => void;
};

export function createReducedMotionListener(): ReducedMotionState {
  if (typeof window === "undefined") {
    return { prefersReducedMotion: false, destroy: () => {} };
  }

  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = { prefersReducedMotion: mediaQuery.matches, destroy };

  function onChange(event: MediaQueryListEvent) {
    state.prefersReducedMotion = event.matches;
  }

  function destroy() {
    mediaQuery.removeEventListener("change", onChange);
  }

  mediaQuery.addEventListener("change", onChange);
  return state;
}
