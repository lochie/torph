---
"torph": patch
---

Inherit `text-align` on the root element instead of forcing `left`

The injected stylesheet set `text-align: left` on the root, which overrode the
alignment of any centred or right-aligned container torph was placed in. It now
uses `text-align: inherit`.

**This changes existing layouts.** Text that was pinned left inside a centred
or right-aligned parent will now follow that parent. If you were relying on the
old behaviour, set `text-align: left` on the element yourself.

Two smaller style changes ship alongside it: the root gets
`vertical-align: top` so it sits on the text baseline consistently when inline,
and segments get `position: relative` so they stack above exiting segments
during a morph.
