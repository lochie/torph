---
"torph": minor
---

Match text with a real diff instead of segment-ID equality

Previously a segment kept its element only if its generated ID happened to
match, so moving a word or editing one character inside it recreated the
element and the text jumped rather than travelled.

Morphs are now built from a longest-common-subsequence diff:

- Words that survive a change keep their element and animate to their new
  position, including when they are reordered.
- Words that don't match exactly are paired by character similarity, and a
  paired word is split into per-character spans so the shared characters morph
  in place instead of the whole word crossfading.
- Ties resolve to the earliest match, so when a word repeats, the first
  occurrence keeps the existing element rather than the text flying across the
  block to the last one.

Two ceilings keep the diff off the main thread for long values, since it runs
synchronously before the first frame. Above ~2,500 unmatched word combinations
the character pairing is skipped and unmatched words enter and exit whole;
above ~1,000,000 word pairs the diff is skipped entirely and the value is
segmented from scratch. Both degrade the animation rather than the text.
