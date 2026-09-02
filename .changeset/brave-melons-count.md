---
"torph": minor
---

Numbers morph by place value, and a morph is readable to screen readers

### Numbers

Numeric words are now matched against the old value digit by digit, so a figure
that changes reads as one number moving rather than one number leaving and
another arriving. On by default — `numbers={false}` for the old character-level
morph.

- Digits keep their column: `99 → 199` grows a digit on the left, and
  `999,999 → 1,000,000` slides its comma along by one group.
- Currency symbols, percent signs and units stay put.
- Only whole numeric tokens qualify, so "COVID-19" and "2024-01-01" still morph
  as text.
- A run of characters with nothing surviving inside it is replaced as one
  gesture rather than column by column. Applies to text too.
- `update()` and the components accept a `number`, formatted with `locale` and
  the new `decimals` option.
- `cursorIndex` matches by caret instead of by column, for editable fields.
- React's `onAnimationStart` and `onAnimationComplete` no longer go stale when
  they close over component state.
- New exports: `segmentNumber`, `isNumericWord`, `decimalSeparator`, and the
  `NumberSegment` and `DiffOptions` types.

### Screen readers

Mid-morph the root holds fragments — a word split to the character, with the
previous value's characters still animating out — so assistive technology read a
value spelled one letter per box with the last one's leftovers interleaved.
Those all carry `aria-hidden` now, and the value is written once as plain text
in a clipped `[torph-sr]` node, which is what gets read. Put `aria-live` on the
element to have changes announced.

Also fixes `prefers-reduced-motion` turning off mid-session: an instance built
while it was on never got the stylesheet, so the first morph after it animated
against nothing.
