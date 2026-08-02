---
"torph": patch
---

Escape text in the React component's server-rendered markup

The React component writes its initial markup through
`dangerouslySetInnerHTML` so the text is present before hydration, but passed
the value through unescaped. Any markup in the text was parsed as HTML, so
`<TextMorph>{value}</TextMorph>` would execute scripts and event handlers in a
value that React would otherwise have rendered as plain text.

The text is now escaped before the newline-to-`<br>` conversion. Nothing
changes for values that were already plain text.
