# torph

## 0.1.4

### Patch Changes

- aee41df: Faster first morph on a page.

  #### Improved
  - The first `TextMorph` on a page no longer pays the browser's text-segmentation startup cost during an interaction.

- 1cab464: Fixes for reported issues.

  #### Fixed
  - Spring easing no longer crashes browsers without CSS `linear()` support, such as older Android WebViews.
  - Numbers formatted with a no-break space before their symbol, as most non-English locales do, roll instead of fading.
  - Settled digits are no longer clipped or faded with a tight `line-height`.

- b1c26f3: Smoother interruptions and line-height changes.

  #### Fixed
  - A word interrupted while animating in now leaves from where it had got to, instead of popping to full opacity and size first.
  - Digits stay unclipped when the line-height or font size changes between updates.

  #### Improved
  - Smaller bundle.

- b1e2a93: Improve rendering and update performance.

  #### Improved
  - Faster initial rendering and frequent text updates, especially with many components.
  - Reduced memory allocation when matching long text sequences.

## 0.1.3

### Patch Changes

- 9acfa1f: Fixes text leaving a morph landing in the wrong place inside a rotated or scaled element.

  #### Fixed
  - Departing characters were misplaced, and digits escaped the band they slide behind, when the morph sat inside a rotated or scaled element.

## 0.1.2

### Patch Changes

- 743ca6b: Keep caret matching honest in a field that groups its digits.

  #### Fixed
  - Typing in a number field that inserts thousand separators no longer scrambles the digits — a comma appearing beside the caret used to make neighbouring digits morph into each other.

- 743ca6b: Keep the box with a value that changes faster than the morph settles.

  #### Fixed
  - Text updated rapidly no longer sits in a box sized to an earlier value until the updates slow down.
  - A prop passed as `undefined` now falls back to its default instead of throwing.

- 743ca6b: Correct sizing for a value inside a rotated or scaled element.

  #### Fixed
  - A value inside a rotated or scaled element no longer grows with every morph.

## 0.1.1

### Patch Changes

- cde5096: Numbers morph by place value, and a morph is readable to screen readers.

  #### New
  - Number morphing, matched digit by digit. On by default — `numbers={false}` to opt out.
  - `update()` and the components accept a `number`, with `locale` and `decimals` options.
  - `cursorIndex`, for editable fields.
  - `segmentNumber`, `isNumericWord` and `decimalSeparator` exports.

  #### Improved
  - Digits keep their column, so `99 → 199` grows a digit on the left.
  - Currency symbols, percent signs and units stay put.
  - `COVID-19` and dates still morph as text.

  #### Fixed
  - Screen readers read the value, not its mid-morph fragments. Add `aria-live` to announce changes.
  - React's `onAnimationStart` and `onAnimationComplete` no longer go stale.

- 7b4e5e0: A word no longer character-morphs across a word that is staying put.

  #### Fixed
  - `Copy Address` → `Address Copied` no longer drags `Cop` past the `Address` between them.

## 0.1.0

### Minor Changes

- c86b1e0: Word- and character-level diffing, multi-line text, and a rewritten container animation

  #### New
  - Multi-line text.
  - Words that survive a change travel to their new position instead of crossfading.
  - `onAnimationCancel`, so a superseded morph can still be awaited.
  - `segmentText` and `diffSegments` exports.

  #### Fixed
  - Markup in a value could execute scripts in React.
  - The container no longer gets stuck at the wrong size.

## 0.0.10

### Patch Changes

- 4462d5e: Fix the container getting stuck collapsed after text is cleared and retyped (#43).
- 4462d5e: Smoother enter animation timings.
- 4462d5e: Sharper positioning at small text sizes.
- 4462d5e: Fix missing `TextMorph` types in Svelte.
- b063c2e: Fix Vue `TextMorph` rendering empty until the `text` prop changes.

## 0.0.9

### Patch Changes

- Fix Svelte SSR, and shrink the framework bundles.

## 0.0.8

### Patch Changes

- 08b3274: Fix the Vue build failing to resolve the `torph` package entry.

## 0.0.7

### Patch Changes

- 83b06a8: Spring easing — new `spring()` helper, and `ease` accepts a `SpringParams` object.
- eb7bce0: Smaller package, 64.9 kB → 11.8 kB, with fixed Vue and Svelte types.
- 83b06a8: Fix animation spam when text changes rapidly.
- f6cb510: Animations redirect smoothly when text changes mid-animation instead of snapping.

## 0.0.6

### Patch Changes

- 7fe6190: Svelte 5 support.
- bcc7d14: `scale` prop on the Vue and Svelte components.
- 48754a5: No longer require string literals for morph targets.
- 48754a5: Fix text overlap during morphing.
- 48754a5: Fix SSR cleanup, tree-shaking and the types export.

## 0.0.5

### Patch Changes

- Better animation.

## 0.0.4

### Patch Changes

- Fix a missing type export.

## 0.0.3

### Patch Changes

- Fix FOUC under SSR.

## 0.0.2

### Patch Changes

- Remove dependencies.

## 0.0.1

- First release.
