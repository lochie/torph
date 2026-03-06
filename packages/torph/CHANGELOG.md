# torph

## 0.0.7

### Patch Changes

- 83b06a8: Add spring-based easing support
  - New `spring()` helper that converts physics parameters (stiffness, damping, mass) into a CSS `linear()` easing and computed duration
  - The `ease` option now accepts a `SpringParams` object in addition to CSS easing strings
  - Add `MorphController` class for managing instance lifecycle and config changes
  - Framework components (React, Svelte, Vue) now use `MorphController` to automatically recreate instances when options change
  - Cap fade durations at 150ms so opacity transitions stay snappy with longer spring durations
  - Export `spring`, `SpringParams`, and `SpringResult` types

- eb7bce0: Fix package exports and reduce bundle size
  - Remove source maps from published package (64.9 kB → 11.8 kB packed)
  - Fix missing `.d.ts` type declarations for Vue and Svelte CJS consumers
  - Fix broken type import paths in Vue/Svelte declarations (inline types instead of referencing non-existent paths)
  - Add `main` and `module` top-level fields for legacy bundler compatibility

- 83b06a8: Fix animation spam when text changes rapidly
  - Merge transform and opacity into a single animation keyframe for enter/persist to prevent flash on interruption
  - Capture computed opacity when detaching exiting elements so interrupted fade-outs resume correctly
  - Reuse existing DOM elements for persistent segments instead of recreating them

- f6cb510: Refactor internal architecture into focused utility modules and make WAAPI animations interruptible
  - Extract FLIP logic, animation helpers, text segmentation, DOM operations, styles, reduced motion detection, and constants into separate utility files
  - Animations now smoothly redirect when text changes mid-animation instead of snapping
  - Fix ref-counted style injection so multiple instances share a single style element
  - Rename internal `Block` type to `Segment`

## 0.0.6

### Patch Changes

- 48754a5: fix: no longer require string literals for morph targets
- 48754a5: fix: SSR cleanup
- 48754a5: fix: text overlap during morphing
- 48754a5: fix: tree-shaking and types export
- 48754a5: fix: correctly remove handleMediaQueryChange listener on destroy
- bcc7d14: add `scale` prop to vue and svelte components
- 7fe6190: feat: Svelte 5 support
- 48754a5: chore: centralize default text morph options

## 0.0.5

### Patch Changes

- update: made the animation better

## 0.0.4

### Patch Changes

- Fixed missing type export

## 0.0.3

### Patch Changes

- Fixed FOUC when using SSR

## 0.0.2

### Patch Changes

- removed dependencies

## 0.0.1

- first release
