---
"torph": patch
---

Morph callbacks and exits settle cleanly.

#### Fixed

- `onAnimationComplete` fires once the text has fully settled, and exactly one of it and `onAnimationCancel` runs per morph.
- Exiting text no longer shifts by a fraction of a pixel as it starts to leave.
