---
"torph": patch
---

Fix Vue `TextMorph` rendering an empty element until the `text` prop changes

A static `:text` value never reached the morph controller, so the root element
stayed empty until reactivity pushed a new value through. This was most visible
in Nuxt, where the SSR markup was empty too.

- Attaching the controller now seeds it with the current `text`.
- The initial text is rendered as the element's child on both the server and the
  client, so SSR markup contains the text and hydration matches it. This
  replaces the `import.meta.server` check, which was never substituted inside
  the published bundle — Nitro externalizes `torph`, leaving `import.meta.server`
  undefined at runtime, and the CJS build compiled the branch away entirely.
