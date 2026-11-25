---
"torph": patch
---

Options change in place.

#### Breaking

- `MorphController.needsRecreate()` is removed. Pass new options to `configure()` instead.

#### New

- `configure()` on `TextMorph` and `MorphController`.

#### Improved

- Changing an option on a mounted `TextMorph` no longer cancels the running morph or rebuilds the text.
