# Torph

Dependency-free animated text morphing component for React, Vue, Svelte, and vanilla JavaScript.

## Installation

```bash
npm install torph
# or
pnpm add torph
# or
yarn add torph
```

## Usage

```tsx
import { TextMorph } from "torph/react";

<TextMorph>{saved ? "Saved" : "Saving"}</TextMorph>;
```

```vue
<TextMorph :text="text" />
<!-- import { TextMorph } from "torph/vue" -->
```

```svelte
<TextMorph {text} />
<!-- import { TextMorph } from "torph/svelte" -->
```

```js
import { TextMorph } from "torph";

const morph = new TextMorph({ element: document.getElementById("status") });
morph.update("Hello World");
```

## Plugins

A plugin changes how text is cut up and how it moves. Put one in front of `classic()`, torph's default set:

```tsx
import { classic } from "torph";
import { mask } from "torph/plugins/mask";

<TextMorph plugins={[mask(), ...classic()]}>{headline}</TextMorph>;
```

See every plugin moving on the [plugins page](https://torph.lochie.me/plugins).

## Documentation

Options, numbers, plugins and writing your own are at [torph.lochie.me/docs](https://torph.lochie.me/docs).

## Found this useful?

Follow me on [Twitter](https://twitter.com/lochieaxon).

## Other projects

You might also like:

- [number-flow](https://number-flow.barvian.me/) - Animated number component by [Maxwell Barvian](https://x.com/mbarvian).
- [easing.dev](https://easing.dev) - Easily create custom easing graphs.

## Acknowledgements

- Thanks to [Alex](https://x.com/alexvanderzon) for assistance with the site design.
- Thanks to [Pugson](https://x.com/pugson) for putting up with my bullshit.
- Thanks to [Benji](https://x.com/benjitaylor) for coining the `Torph` name and outlining the method in [Family Values](https://benji.org/family-values#:~:text=This%20effect%20is,0.5x).

## License

MIT
