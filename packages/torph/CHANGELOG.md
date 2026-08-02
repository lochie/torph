# torph

## 0.0.10

### Patch Changes

- 4462d5e: Fix the container staying collapsed at `0px` after text is cleared and retyped

  When text was cleared and a new character typed before the fade completed,
  `element.offsetWidth` measured 0 and hit the early-return guard in
  `transitionContainerSize`, leaving inline `width`/`height` pinned at `0px`
  permanently. The guard now resets both to `auto` before returning, so the
  container reverts to natural content sizing.

  Fixes #43

- 4462d5e: Improve enter animation timings

  Entering segments animated their transform from a single keyframe with no
  explicit end state, and faded in from the moment the morph started — so new
  characters appeared before the segments around them had moved into place. The
  transform now runs as an explicit two-keyframe animation ending at `none`, and
  the fade for new segments is delayed by a quarter of the duration so movement
  resolves first.

- 4462d5e: Use subpixel measurements for morph layout

  Layout previously read `offsetWidth`/`offsetHeight`/`offsetLeft`/`offsetTop`,
  which round to whole pixels. At small sizes and on fractional-DPI displays the
  rounding accumulated across segments, so characters drifted from their measured
  positions and the container size transition landed slightly off. Measurement now
  goes through `getBoundingClientRect()`, with exiting segments positioned
  relative to the container's rect.

- 4462d5e: Fix the `TextMorph` type not passing through from the Svelte build

  `torph/svelte` exported the component without a type declaration, so
  TypeScript consumers got an implicit `any` (or an error under
  `noImplicitAny`) when importing `TextMorph`. It is now declared as
  `Component<TextMorphProps>`.

- b063c2e: Fix Vue `TextMorph` rendering an empty element until the `text` prop changes

  A static `:text` value never reached the morph controller, so the root element
  stayed empty until reactivity pushed a new value through. This was most visible
  in Nuxt, where the SSR markup was empty too.
  - Attaching the controller now seeds it with the current `text`.
  - The initial text is rendered as the element's child on both the server and the
    client, so SSR markup contains the text and hydration matches it. This
    replaces the `import.meta.server` check, which was never substituted inside
    the published bundle — Nitro externalizes `torph`, leaving `import.meta.server`
    undefined at runtime, and the CJS build compiled the branch away entirely.

## 0.0.9

### Patch Changes

- fix: ship raw .svelte source for SSR compatibility, deduplicate core lib from framework bundles

## 0.0.8

### Patch Changes

- 08b3274: Fix Vue build failing to resolve `torph` package entry. Replaced `.vue` SFC with compiled `defineComponent` so tsup can bundle it directly, and simplified the Vue tsup config to a single build step with proper type generation.

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
