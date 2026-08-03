---
"torph": minor
---

Add `onAnimationCancel`, and stop dropping the end of an interrupted morph

A morph that was superseded before it finished went silent: the container
transition was cancelled without calling `onAnimationComplete`, so anything
sequencing off that callback — a loading state, a chained animation, an
`await` — waited forever. Rapid input hit this constantly, because every
keystroke interrupts the morph before it. The same happened when a morph was
skipped because the element had no size to animate from.

`onAnimationCancel` now fires in both cases, and is available on the core class
and the React, Vue, and Svelte components:

```jsx
<TextMorph
  onAnimationComplete={() => setBusy(false)}
  onAnimationCancel={() => setBusy(false)}
>
  {text}
</TextMorph>
```

Exactly one of `onAnimationComplete` and `onAnimationCancel` runs per morph, so
a morph can always be awaited. `destroy()` fires neither — teardown is not an
animation event.

Morphing to an empty value also stopped taking over the container's size while
a previous transition was still running. That animation used `fill: "both"`, so
it outranked the inline width and height the empty transition sets, kept driving
the size, and then reset it to `auto` when it finished — leaving the container
collapsed mid-exit.
