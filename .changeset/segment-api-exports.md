---
"torph": minor
---

Export the segmentation and diff primitives

`segmentText` and `diffSegments` are now part of the public API, along with the
`Segment` and `DiffResult` types. They are the same functions the morph
controller uses, exposed for building custom behaviour on top of torph's text
matching — inspecting which segments persist across a change, or driving your
own animation from the diff.
