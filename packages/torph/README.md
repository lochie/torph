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

## Framework Usage

### React

```tsx
import { TextMorph } from "torph/react";

function App() {
  const [text, setText] = useState("Hello World");

  return (
    <TextMorph
      duration={400}
      ease="cubic-bezier(0.19, 1, 0.22, 1)"
      locale="en"
      onAnimationComplete={() => console.log("Animation done!")}
      className="my-text"
      as="h1"
    >
      {text}
    </TextMorph>
  );
}
```

#### React Hook

```tsx
import { useTextMorph } from "torph/react";

function CustomComponent() {
  const { ref, update } = useTextMorph({
    duration: 400,
    ease: "cubic-bezier(0.19, 1, 0.22, 1)",
  });

  useEffect(() => {
    update("Hello World");
  }, []);

  return <div ref={ref} />;
}
```

### Vue

```vue
<script setup>
import { ref } from "vue";
import { TextMorph } from "torph/vue";

const text = ref("Hello World");

const handleComplete = () => {
  console.log("Animation done!");
};
</script>

<template>
  <TextMorph
    :text="text"
    :duration="400"
    ease="cubic-bezier(0.19, 1, 0.22, 1)"
    locale="en"
    :onAnimationComplete="handleComplete"
    class="my-text"
    as="h1"
  />
</template>
```

### Svelte

```svelte
<script>
  import { TextMorph } from 'torph/svelte';

  let text = $state('Hello World');

  const handleComplete = () => {
    console.log('Animation done!');
  };
</script>

<TextMorph
  {text}
  duration={400}
  ease="cubic-bezier(0.19, 1, 0.22, 1)"
  locale="en"
  onAnimationComplete={handleComplete}
  class="my-text"
  as="h1"
/>
```

### Vanilla JS

```js
import { TextMorph } from "torph";

const morph = new TextMorph({
  element: document.getElementById("morph"),
  duration: 400,
  ease: "cubic-bezier(0.19, 1, 0.22, 1)",
  locale: "en",
  onAnimationStart: () => console.log("Starting..."),
  onAnimationComplete: () => console.log("Done!"),
});

morph.update("Hello World");
```

## Spring Animations

Pass spring parameters to `ease` for physics-based easing. The duration is computed automatically from the spring physics.

```tsx
import { TextMorph } from "torph/react";

function App() {
  const [text, setText] = useState("Hello World");

  return (
    <TextMorph ease={{ stiffness: 200, damping: 20 }}>{text}</TextMorph>
  );
}
```

### Spring Parameters

| Parameter   | Type     | Default | Description                               |
| ----------- | -------- | ------- | ----------------------------------------- |
| `stiffness` | `number` | `100`   | Spring stiffness coefficient              |
| `damping`   | `number` | `10`    | Damping coefficient                       |
| `mass`      | `number` | `1`     | Mass of the spring                        |
| `precision` | `number` | `0.001` | Threshold for determining settled position |

## API

### Options

All components accept the following props/options:

- `text` / `children: string` - The text to display (required)
- `duration?: number` - Animation duration in milliseconds (default: `400`)
- `ease?: string | SpringParams` - CSS easing function or spring parameters (default: `"cubic-bezier(0.19, 1, 0.22, 1)"`)
- `scale?: boolean` - Enable scale animation on exiting segments (default: `true`)
- `locale?: Intl.LocalesArgument` - Locale for text segmentation (default: `"en"`)
- `debug?: boolean` - Enable debug mode with visual indicators
- `disabled?: boolean` - Disable all morphing animations (default: `false`)
- `respectReducedMotion?: boolean` - Respect user's prefers-reduced-motion setting (default: `true`)
- `onAnimationStart?: () => void` - Callback fired when animation begins
- `onAnimationComplete?: () => void` - Callback fired when animation completes
- `className?: string` - CSS class name (React/Vue: `class`)
- `style?: object | string` - Inline styles
- `as?: string` - HTML element type (default: `"span"`)

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
