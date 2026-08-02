---
"torph": minor
---

Support multi-line text

Newlines in a value are now real line breaks. They are segmented as their own
units, rendered as `<br>` elements, and excluded from measurement and
animation so the surrounding text still morphs normally across a wrapped
value. Blank lines and runs of consecutive newlines are preserved.

The React component also emits the line breaks in its server-rendered markup,
so multi-line values are laid out correctly before hydration. The Vue and
Svelte components render multi-line text correctly on the client, but their
server-rendered markup is still single-line until the controller attaches.
