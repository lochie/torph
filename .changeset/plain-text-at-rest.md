---
"torph": patch
---

Text at rest is plain text.

#### Improved

- Text at rest is drawn as plain text, so kerning, ligatures, joining scripts and font changes are exactly the browser's.
- Text at rest can be selected and copied.
- Long text and pages full of instances morph without stalling.

#### Fixed

- Letters no longer jump when a morph interrupts another part-way through a word.
- Text inside a scaled or rotated parent no longer jumps when a morph starts.
- Contextual alternates, like a colon raised between digits, hold their shape while text animates.
- Devanagari, Thai and other scripts whose letters shape each other stay shaped while animating.
