---
"torph": patch
---

Refactor internal architecture into focused utility modules and make WAAPI animations interruptible

- Extract FLIP logic, animation helpers, text segmentation, DOM operations, styles, reduced motion detection, and constants into separate utility files
- Animations now smoothly redirect when text changes mid-animation instead of snapping
- Fix ref-counted style injection so multiple instances share a single style element
- Rename internal `Block` type to `Segment`
