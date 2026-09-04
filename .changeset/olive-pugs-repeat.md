---
"torph": patch
---

Keep the box with a value that changes faster than the morph settles.

#### Fixed

- Text updated rapidly no longer sits in a box sized to an earlier value until the updates slow down.
- A prop passed as `undefined` now falls back to its default instead of throwing.
