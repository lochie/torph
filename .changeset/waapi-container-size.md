---
"torph": minor
---

Animate the container with the Web Animations API instead of a CSS transition

The container's width and height were driven by a CSS transition while the
segments inside it were driven by WAAPI, so the two were started by different
mechanisms and could drift apart — most visibly on centred and right-aligned
text, where a container that resizes slightly ahead of its contents drags every
segment with it.

Both now run on WAAPI, created in the same synchronous block and sharing a
start time, duration, and easing. Segment positions are also measured at the
old container width, so the first frame is correct even when the text overflows
its container and `text-align` has no effect.

Two consequences for the DOM:

- The `transition-property: width, height` declaration is gone from the
  injected stylesheet. Torph sets `transition-property: none` inline on the
  root for the duration of a morph and clears the inline value afterwards, so a
  transition of your own on that element will not survive a morph.
- The root's `will-change` and the fallback `setTimeout` that used to cover a
  missed `transitionend` are no longer part of the completion path;
  `onAnimationComplete` now fires from the animation's own `finish` event.
