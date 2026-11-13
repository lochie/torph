---
"torph": patch
---

Fixes for reported issues.

#### Fixed

- Spring easing no longer crashes browsers without CSS `linear()` support, such as older Android WebViews.
- Numbers formatted with a no-break space before their symbol, as most non-English locales do, roll instead of fading.
- Settled digits are no longer clipped or faded with a tight `line-height`.
