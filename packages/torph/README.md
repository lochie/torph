# Torph

Animated text morphing component for React, Vue, and Svelte.

## Installation

```bash
npm install torph
# or
pnpm add torph
# or
yarn add torph
```

## Framework Usage

### React

```tsx
import { TextMorph } from 'torph/react';

function App() {
  const [text, setText] = useState('Hello World');

  return (
    <TextMorph
      duration={400}
      ease="cubic-bezier(0.19, 1, 0.22, 1)"
      locale="en"
    >
      {text}
    </TextMorph>
  );
}
```

#### React Hook

```tsx
import { useTextMorph } from 'torph/react';

function CustomComponent() {
  const { ref, update } = useTextMorph({
    duration: 400,
    ease: "cubic-bezier(0.19, 1, 0.22, 1)",
  });

  useEffect(() => {
    update('Hello World');
  }, []);

  return <div ref={ref} />;
}
```

### Vue

```vue
<script setup>
import { ref } from 'vue';
import { TextMorph } from 'torph/vue';

const text = ref('Hello World');
</script>

<template>
  <TextMorph
    :text="text"
    :duration="400"
    ease="cubic-bezier(0.19, 1, 0.22, 1)"
    locale="en"
  />
</template>
```

### Svelte

```svelte
<script>
  import { TextMorph } from 'torph/svelte';
  
  let text = 'Hello World';
</script>

<TextMorph
  {text}
  duration={400}
  ease="cubic-bezier(0.19, 1, 0.22, 1)"
  locale="en"
/>
```

### Vanilla JS

```js
import { TextMorph } from 'torph';

const morph = new TextMorph({
  element: document.getElementById('morph'),
  duration: 400,
  ease: 'cubic-bezier(0.19, 1, 0.22, 1)',
  locale: 'en',
});

morph.update('Hello World');
```

## API

### Options

All components accept the following props/options:

- `text` / `children: string` - The text to display (required)
- `duration?: number` - Animation duration in milliseconds (default: 400)
- `ease?: string` - CSS easing function (default: "cubic-bezier(0.19, 1, 0.22, 1)")
- `locale?: Intl.LocalesArgument` - Locale for text segmentation (default: "en")
- `debug?: boolean` - Enable debug mode with visual indicators

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
