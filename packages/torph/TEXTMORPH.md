# TextMorph API Reference

## Types

### TextMorphOptions

```typescript
interface TextMorphOptions {
  element: HTMLElement;
  locale?: Intl.LocalesArgument;  // default: "en"
  duration?: number;              // default: 400 (ms)
  ease?: string;                  // default: "cubic-bezier(0.19, 1, 0.22, 1)"
  debug?: boolean;                // default: false
}
```

## Core API

### TextMorph Class

```typescript
class TextMorph {
  constructor(options: TextMorphOptions)
  update(value: string): void
  destroy(): void
}
```

## React

### TextMorph Component

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  children: string;
}
```

```tsx
import { TextMorph } from 'torph/react';

<TextMorph duration={400} ease="ease-out" locale="en" debug={false}>
  {text}
</TextMorph>
```

### useTextMorph Hook

```typescript
function useTextMorph(
  props: Omit<TextMorphOptions, 'element'>
): {
  ref: React.RefObject<HTMLDivElement>;
  update: (text: string) => void;
}
```

```tsx
import { useTextMorph } from 'torph/react';

const { ref, update } = useTextMorph({ duration: 400 });
```

## Vue

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  text: string;
}
```

```vue
<script setup>
import { TextMorph } from 'torph/vue';
</script>

<template>
  <TextMorph :text="text" :duration="400" locale="en" />
</template>
```

## Svelte

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  text: string;
  locale?: Intl.LocalesArgument;
  duration?: number;
  ease?: string;
  debug?: boolean;
}
```

```svelte
<script>
  import { TextMorph } from 'torph/svelte';
</script>

<TextMorph {text} duration={400} locale="en" />
```

## Vanilla JS

```javascript
import { TextMorph } from 'torph';

const morph = new TextMorph({
  element: document.getElementById('morph'),
  duration: 400,
  locale: 'en'
});

morph.update('Hello World');
morph.destroy();
```
