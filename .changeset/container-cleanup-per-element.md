---
"torph": patch
---

Fix multiple instances on one page interrupting each other's size transitions

The pending container-transition cleanup was held in a module-level variable
shared by every instance, so a second `TextMorph` starting a morph cancelled
the first one's cleanup. The first container was left pinned at an inline
width and height and never restored to `auto`, and its `onAnimationComplete`
never fired.

Cleanups are now tracked per element in a `WeakMap`, so instances only
interrupt themselves.

`destroy()` now stops a morph that is still running and restores the element's
width, height and `transition-property`, instead of leaving it pinned at the
size it happened to be mid-animation.
