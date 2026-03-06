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
