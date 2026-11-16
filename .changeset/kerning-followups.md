---
"torph": patch
---

Right-to-left text and memory.

#### Fixed

- Text whose direction differs from the page's, like an English label on a Hebrew page, no longer draws its letters in reverse.
- Arabic and other joining scripts keep their letters joined while animating.
- An instance whose element is removed without `destroy()` no longer stays in memory.
