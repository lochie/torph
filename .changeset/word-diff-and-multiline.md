---
"torph": minor
---

Word- and character-level diffing, multi-line text, and a rewritten container animation

A segment used to keep its element only when its generated ID happened to
match, so moving a word or editing one character inside it recreated the
element and the text jumped rather than travelled. Matching is now a real
longest-common-subsequence diff, and the container animates on the same clock
as the text inside it.

### Breaking

The injected stylesheet no longer forces `text-align: left` on the root; it
inherits instead. **Text that was pinned left inside a centred or right-aligned
parent will now follow that parent.** Set `text-align: left` on the element
yourself to keep the old behaviour.

`transition-property: width, height` is also gone from the stylesheet. Torph
sets `transition-property: none` inline for the duration of a morph and clears
it afterwards, so a CSS transition of your own on that element will not survive
a morph.

### Text matching

- Words that survive a change keep their element and animate to their new
  position, including when they are reordered.
- Words that don't match exactly are paired by character similarity, and a
  paired word is split into per-character spans so the shared characters morph
  in place instead of the whole word crossfading.
- Ties resolve to the earliest match, so a repeated word keeps its element on
  the first occurrence rather than flying across the block to the last one.

The diff runs synchronously before the first frame, so two ceilings keep it off
the main thread: above ~2,500 unmatched word combinations the character pairing
is skipped and unmatched words enter and exit whole; above ~1,000,000 word
pairs the diff is skipped entirely and the value is segmented from scratch.
Both degrade the animation, never the text.

### Multi-line text

Newlines are real line breaks — segmented as their own units, rendered as
`<br>`, and excluded from measurement and animation so the surrounding text
still morphs normally across a wrapped value. Blank lines and runs of
consecutive newlines are preserved.

The React component emits the breaks in its server-rendered markup, so
multi-line values are laid out correctly before hydration. Vue and Svelte
render multi-line text correctly on the client, but their server-rendered
markup is still single-line until the controller attaches.

### `onAnimationCancel`

A morph superseded before it finished went silent: the container transition was
cancelled without calling `onAnimationComplete`, so anything sequencing off that
callback — a loading state, a chained animation, an `await` — waited forever.
Rapid input hit this constantly, because every keystroke interrupts the morph
before it.

```jsx
<TextMorph
  onAnimationComplete={() => setBusy(false)}
  onAnimationCancel={() => setBusy(false)}
>
  {text}
</TextMorph>
```

Exactly one of the two runs per morph, so a morph can always be awaited.
`destroy()` fires neither — teardown is not an animation event. Available on
the core class and the React, Vue and Svelte components.

### New exports

`segmentText` and `diffSegments`, along with the `Segment` and `DiffResult`
types. They are the same functions the morph controller uses, exposed for
building on top of torph's text matching — inspecting which segments persist
across a change, or driving your own animation from the diff.

### Fixes

- The React component wrote its pre-hydration markup through
  `dangerouslySetInnerHTML` without escaping it, so markup in a value was
  parsed as HTML and could execute scripts and event handlers. It is now
  escaped.
- The container's size ran on a CSS transition while its segments ran on WAAPI,
  so the two could drift apart — most visibly on centred and right-aligned
  text, where a container that resizes ahead of its contents drags every
  segment with it. Both now run on WAAPI, created in the same synchronous block
  and sharing a start time, duration and easing. Positions are measured at the
  old container width, so the first frame is correct even when the text
  overflows and `text-align` has no effect.
- Pending container cleanup was module-level state shared by every instance, so
  a second `TextMorph` starting a morph cancelled the first one's cleanup and
  left it pinned at an inline width and height. Cleanups are tracked per
  element now.
- `destroy()` stops a morph that is still running and restores the element's
  width, height and `transition-property`, instead of leaving it pinned at
  whatever size it reached.
- Morphing to an empty value no longer loses the container's size to a
  transition that is still running, which left the container collapsed
  mid-exit.
- The Vue component's `class` and `ease` props were typed `any`. They are now
  `string | string[] | Record<string, boolean>` and `string | SpringParams`.
- The root gets `vertical-align: top` so it sits on the text baseline
  consistently when inline, and segments get `position: relative` so they stack
  above exiting segments during a morph.
