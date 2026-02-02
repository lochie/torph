# TextMorph Component Documentation

## Overview

TextMorph is an animated text morphing component that smoothly transitions between text changes with character-level animations. It provides a fluid, visually appealing way to update text content by animating individual characters or words as they enter, exit, or move positions.

## Core Architecture

### TextMorph Class

The `TextMorph` class is the core implementation that handles all text morphing animations. It works with any framework or vanilla JavaScript.

#### Constructor

```typescript
constructor(options: TextMorphOptions)
```

Creates a new TextMorph instance attached to an HTML element.

**Example:**
```javascript
const morph = new TextMorph({
  element: document.getElementById('my-text'),
  duration: 400,
  ease: 'cubic-bezier(0.19, 1, 0.22, 1)',
  locale: 'en',
  debug: false
});
```

#### Methods

##### `update(value: string)`

Updates the text content with a smooth animation transition.

```javascript
morph.update('Hello World');
```

##### `destroy()`

Cleans up the TextMorph instance, canceling all animations and removing attributes.

```javascript
morph.destroy();
```

### How It Works

1. **Text Segmentation**: TextMorph uses `Intl.Segmenter` to break text into graphemes (individual characters) or words based on locale.
2. **Position Tracking**: It measures the position of each text segment before and after updates.
3. **Animation**: Characters that exist in both old and new text are animated from their old position to their new position.
4. **Entry Animation**: New characters fade in and scale slightly.
5. **Exit Animation**: Removed characters fade out and move toward nearby characters.
6. **Container Resize**: The container smoothly animates its width and height to accommodate the new text.

## Types

### TextMorphOptions

The main configuration interface for TextMorph instances.

```typescript
interface TextMorphOptions {
  element: HTMLElement;
  locale?: Intl.LocalesArgument;
  duration?: number;
  ease?: string;
  debug?: boolean;
}
```

#### Properties

- **`element`** (required): `HTMLElement`
  - The DOM element where text morphing will occur
  - Must be a valid HTML element reference

- **`locale`** (optional): `Intl.LocalesArgument`
  - Controls text segmentation behavior using the Intl.Segmenter API
  - Default: `"en"`
  - Examples: `"en"`, `"es"`, `"ja"`, `["en-US", "en"]`
  - Affects whether text is split by characters or words

- **`duration`** (optional): `number`
  - Animation duration in milliseconds
  - Default: `400`
  - Controls how long the morphing animation takes

- **`ease`** (optional): `string`
  - CSS easing function for animations
  - Default: `"cubic-bezier(0.19, 1, 0.22, 1)"`
  - Any valid CSS timing function string
  - Examples: `"ease-in-out"`, `"cubic-bezier(0.4, 0, 0.2, 1)"`

- **`debug`** (optional): `boolean`
  - Enables debug mode with visual indicators
  - Default: `false`
  - When enabled, adds colored outlines around the container (magenta) and individual text segments (cyan)

## Framework Implementations

### React

#### TextMorph Component

The React component provides a declarative way to use TextMorph.

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  children: string;
}
```

**Usage:**
```tsx
import { TextMorph } from 'torph/react';

function App() {
  const [text, setText] = useState('Hello World');
  
  return (
    <TextMorph
      duration={400}
      ease="cubic-bezier(0.19, 1, 0.22, 1)"
      locale="en"
      debug={false}
    >
      {text}
    </TextMorph>
  );
}
```

#### useTextMorph Hook

The `useTextMorph` hook provides more control over the TextMorph instance.

```typescript
function useTextMorph(
  props: Omit<TextMorphOptions, 'element'>
): {
  ref: React.RefObject<HTMLDivElement>;
  update: (text: string) => void;
}
```

**Returns:**
- `ref`: React ref to attach to a DOM element
- `update`: Function to update the text programmatically

**Usage:**
```tsx
import { useTextMorph } from 'torph/react';

function CustomComponent() {
  const { ref, update } = useTextMorph({
    duration: 400,
    ease: "cubic-bezier(0.19, 1, 0.22, 1)",
    locale: "en"
  });

  useEffect(() => {
    update('Hello World');
  }, []);

  return <div ref={ref} />;
}
```

### Vue

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  text: string;
}
```

**Usage:**
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
    :debug="false"
  />
</template>
```

### Svelte

```typescript
interface TextMorphProps extends Omit<TextMorphOptions, 'element'> {
  text: string;
  locale?: Intl.LocalesArgument;
  duration?: number;
  ease?: string;
  debug?: boolean;
}
```

**Usage:**
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
  debug={false}
/>
```

### Vanilla JavaScript

For direct DOM manipulation without a framework:

```javascript
import { TextMorph } from 'torph';

const element = document.getElementById('morph');
const morph = new TextMorph({
  element: element,
  duration: 400,
  ease: 'cubic-bezier(0.19, 1, 0.22, 1)',
  locale: 'en',
  debug: false
});

// Update text
morph.update('Hello World');

// Later, clean up
morph.destroy();
```

## Advanced Usage

### Debugging

Enable debug mode to visualize the text morphing process:

```tsx
<TextMorph debug={true}>
  {text}
</TextMorph>
```

This will add:
- Magenta outline around the container
- Cyan outlines around individual text segments
- Helps understand how text is being segmented and animated

### Custom Easing

You can use any CSS timing function:

```tsx
// Ease-in-out
<TextMorph ease="ease-in-out">{text}</TextMorph>

// Custom cubic bezier
<TextMorph ease="cubic-bezier(0.4, 0, 0.2, 1)">{text}</TextMorph>

// Steps
<TextMorph ease="steps(4, end)">{text}</TextMorph>
```

### Locale-Specific Segmentation

Different locales segment text differently:

```tsx
// English - segments by characters or words
<TextMorph locale="en">{text}</TextMorph>

// Japanese - segments by grapheme clusters
<TextMorph locale="ja">{text}</TextMorph>

// Multi-locale fallback
<TextMorph locale={["ja-JP", "ja", "en"]}>{text}</TextMorph>
```

### Performance Considerations

- **Duration**: Shorter durations (200-400ms) feel snappier, longer durations (600-1000ms) feel more dramatic
- **Text Length**: Works best with short to medium text (1-100 characters)
- **Update Frequency**: Avoid updating text more than once every `duration` milliseconds to prevent animation conflicts

## Internal Implementation Details

### Text Segmentation Algorithm

The component uses `Intl.Segmenter` to intelligently split text:
- If text contains spaces, it segments by words
- Otherwise, it segments by grapheme clusters (handles emojis and complex characters correctly)

### Animation Strategy

1. **Measure**: Records positions of all existing text segments
2. **Update DOM**: Removes moved segments and adds new ones
3. **Measure Again**: Records new positions
4. **Animate**: Calculates deltas and creates Web Animations API keyframes
5. **Cleanup**: Removes exiting elements after animation completes

### Exiting Animation

Characters being removed:
1. Are positioned absolutely
2. Find the nearest remaining character
3. Animate 50% of the way toward that character while fading out
4. Are removed from the DOM after animation completes

### Container Sizing

The container animates its width and height:
1. Captures old dimensions
2. Allows container to size to new content
3. Captures new dimensions
4. Animates from old to new dimensions
5. Resets to `auto` after animation

## Browser Compatibility

TextMorph requires:
- `Intl.Segmenter` - [Browser Support](https://caniuse.com/mdn-javascript_builtins_intl_segmenter)
- Web Animations API - [Browser Support](https://caniuse.com/web-animation)

Supported in:
- Chrome/Edge 87+
- Firefox 125+
- Safari 14.1+

## Limitations

- **Single Line**: Currently optimized for single-line text (uses `display: inline-flex`)
- **Text Only**: Only supports string content, not HTML elements
- **No Nested Elements**: Cannot contain other components or HTML tags

## Examples

### Counter Animation

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <TextMorph duration={300}>{count.toString()}</TextMorph>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}
```

### Status Updates

```tsx
function StatusIndicator() {
  const [status, setStatus] = useState('Idle');
  
  return (
    <TextMorph ease="ease-out" duration={250}>
      {status}
    </TextMorph>
  );
}
```

### Word Rotation

```tsx
function RotatingWord() {
  const words = ['Amazing', 'Incredible', 'Fantastic', 'Wonderful'];
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % words.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div>
      This is <TextMorph>{words[index]}</TextMorph>!
    </div>
  );
}
```

## Styling

The TextMorph component adds minimal styles:
- Container uses `display: inline-flex` and `position: relative`
- Individual segments use `display: inline-block`
- All necessary transitions and animations are applied automatically

You can style the container element normally:

```tsx
<TextMorph 
  style={{ 
    fontSize: '2rem', 
    fontWeight: 'bold',
    color: 'blue'
  }}
>
  {text}
</TextMorph>
```

Or using CSS classes:

```tsx
<TextMorph className="my-custom-text">
  {text}
</TextMorph>
```

## License

MIT
