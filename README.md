# Torph

Dependency-free animated text morphing component for React, Vue, Svelte, and vanilla JavaScript.

## Installation

```shell
pnpm i torph
```

## Usage

```tsx
import { TextMorph } from "torph/react";

<TextMorph>Hello world</TextMorph>;
```

### Numbers

Numeric words morph by place value: digits slide along the block axis and the
symbols around them travel with the places they belong to. It is on by default,
so any value containing a number already animates this way.

```tsx
import { TextMorph } from "torph/react";

// 1,204 → 1,318 rolls the hundreds and tens, leaves the thousands alone
<TextMorph>{`$${total.toLocaleString("en")}`}</TextMorph>;
```

For a field somebody is typing in, pass the caret position so the update matches
by position rather than by place value:

```tsx
<TextMorph cursorIndex={caret}>{value}</TextMorph>;
```

### Spring Animations

Use physics-based spring easing by passing spring parameters to `ease`:

```tsx
import { TextMorph } from "torph/react";

<TextMorph ease={{ stiffness: 200, damping: 20 }}>Hello world</TextMorph>;
```

See the [package README](packages/torph/README.md) for full API documentation.

# Contributing

## Install dependencies

```sh
pnpm install:all
```

## Dev/Watch Library and Example

```sh
pnpm dev
```

## Build Library

```sh
pnpm build
```

## Found this useful?

Follow me on [Twitter](https://twitter.com/lochieaxon).

## Other projects

You might also like:

- [number-flow](https://number-flow.barvian.me/) - Animated number component by [Maxwell Barvian](https://x.com/mbarvian).
- [easing.dev](https://easing.dev) - Easily create custom easing graphs.

# Acknowledgements

- Thanks to [Alex](https://x.com/alexvanderzon) for assistance with the site design.
- Thanks to [Pugson](https://x.com/pugson) for putting up with my bullshit.
- Thanks to [Benji](https://x.com/benjitaylor) for coining the `Torph` name and outlining the method in [Family Values](https://benji.org/family-values#:~:text=This%20effect%20is,0.5x).
