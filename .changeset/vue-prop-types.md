---
"torph": patch
---

Type the Vue component's `class` and `ease` props

Both were declared `any`, so Vue consumers got no checking on either and no
completions for spring parameters. `ease` is now `string | SpringParams`, and
`class` is `string | string[] | Record<string, boolean>` — the three shapes
Vue's class binding accepts.

Values that were already valid are unaffected. Anything that relied on the
props being untyped will now be reported: a class value outside those shapes,
or an `ease` object that isn't spring parameters.
