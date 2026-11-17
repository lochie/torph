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

  return <TextMorph ease={{ stiffness: 200, damping: 20 }}>{text}</TextMorph>;
}
```

### Spring Parameters

| Parameter   | Type     | Default | Description                                |
| ----------- | -------- | ------- | ------------------------------------------ |
| `stiffness` | `number` | `100`   | Spring stiffness coefficient               |
| `damping`   | `number` | `10`    | Damping coefficient                        |
| `mass`      | `number` | `1`     | Mass of the spring                         |
| `precision` | `number` | `0.001` | Threshold for determining settled position |

## Numbers

Numeric words morph by place value: digits slide along the block axis, and the
symbols around them — currency, separators, signs, suffixes — travel with the
places they belong to. It is on by default, so any value that contains a number
already animates this way. It's the `numbers()` plugin in torph's default set;
pass `plugins` without it to fall back to the character-level text morph.

```tsx
import { TextMorph } from "torph/react";

// 1,204 → 1,318 rolls the hundreds and tens, leaves the thousands alone
<TextMorph>{`$${total.toLocaleString("en")}`}</TextMorph>;
```

A value passed as a number rather than a string is formatted for you, so
`locale` and `decimals` apply:

```tsx
<TextMorph decimals={2} locale="de-DE">
  {1234.5}
</TextMorph>
```

### Editable fields

Place matching is the right default for a value that changes on its own — a
counter, a total, a chart readout. It is the wrong one for a field somebody is
typing in, where the character that just changed is known and place value is not
the point: typing `1` in front of `20` should insert a digit, not renumber the
column.

Pass `cursorIndex` to switch that update from place matching to caret matching.
It is available on the React component and as the second argument to
`update()`; a caret position is a DOM concern, so there is no Vue or Svelte prop
for it.

```tsx
const [value, setValue] = useState("");
const [caret, setCaret] = useState<number>();

<input
  value={value}
  onChange={(e) => {
    setCaret(e.target.selectionStart ?? undefined);
    setValue(e.target.value);
  }}
/>
<TextMorph cursorIndex={caret}>{value}</TextMorph>
```

```js
morph.update("$120", 2);
```

## Plugins

A plugin changes how a value is cut into pieces, how those pieces move, or both.
torph's own look is a set of plugins too, `classic()`: `numbers()` for figures,
`groups()` for long runs replaced whole, `fade()` for text arriving and leaving,
and `scale()` for the little shrink as it does. With no `plugins`, that set
runs.

Pass `plugins` and your list replaces it. To add to torph's look, put yours
first, so it claims words and overrides motion before the classic ones do:

```tsx
import { TextMorph } from "torph/react";
import { classic } from "torph";
import { blur } from "torph/plugins/blur";

<TextMorph plugins={[blur(), ...classic()]}>{status}</TextMorph>;
```

To drop part of the look, list the rest: `[groups(), fade(), scale()]` has no
numbers, `[numbers(), groups(), fade()]` no scale. `scale()` rides on whatever
moves text, so it scales a plugin's own motion too; leave it out if that plugin
scales on its own. `plugins={[]}` is the engine alone: staying text still
slides, arriving text appears and leaving text goes.

A new array on every render is fine: a plugin is matched by its name and
options, and the morph is only rebuilt when those change.

| Plugin                     | What it does                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `torph/plugins/blur`       | Letter by letter, text rises into focus and blurs away upwards. `{ amount, rise, stagger }`                                                                                                     |
| `torph/plugins/words`      | A changed word swaps whole, instead of morphing the letters it shares.                                                                                                                          |
| `torph/plugins/scramble`   | Letter by letter, arriving text scrambles into place and leaving text scrambles away. `{ glyphs, rate, stagger }`                                                                               |
| `torph/plugins/flap`       | Like a departure board, each place flips round to the new letter. `{ glyphs, flips }`                                                                                                           |
| `torph/plugins/typewriter` | Old text backspaces from the end, then the new text types in. `{ keystroke }`                                                                                                                   |
| `torph/plugins/tokens`     | Identifiers and paths change at their joins: `getUserName` → `getUserEmail` keeps `getUser`.                                                                                                    |
| `torph/plugins/odometer`   | Figures count like a car's odometer, every wheel turning the way the value went. `{ trend }`                                                                                                    |
| `torph/plugins/wave`       | Letter by letter, text drops in with a bounce and falls away under its own weight. `{ height, stagger }`                                                                                        |
| `torph/plugins/caseless`   | A letter that only changes case keeps its box, and pops to the new one in place.                                                                                                                |
| `torph/plugins/stack`      | The whole value is one card: the old one slides up and away as the new one rises in. `{ rise }`                                                                                                 |
| `torph/plugins/squash`     | Like a cartoon: moving text winds up, stretches along its path and lands with a squash and a wobble; arriving text drops in and splats, leaving text squishes flat and zips away. `{ stretch }` |
| `torph/plugins/redline`    | Like track changes: removed words stay struck through before they go, added words come underlined. Several lines diff a line at a time, like code. `{ linger, removed, added }`                 |
| `torph/plugins/countup`    | A figure counts through the values between, quick at first and slowing as it arrives. `{ time, steps }`                                                                                         |
| `torph/plugins/rows`       | Each line is one box, known by its key, so a reordered list slides every row to its new place. `{ key }`                                                                                        |
| `torph/plugins/trend`      | What changes in a figure flashes green as it rises and red as it falls. `{ up, down }`                                                                                                          |
| `torph/plugins/reveal`     | Each place turns over in place to its new character, like a masked value revealed. `{ stagger }`                                                                                                |

### Writing a plugin

A plugin is an object with a `name` and the hooks it needs. This one fades
plain text in from below:

```ts
import type { TorphPlugin } from "torph";

export const rise: TorphPlugin = {
  name: "rise",
  animate: {
    text: {
      enter: (box, { delta, duration, ease }) => [
        box.animate(
          [
            {
              transform: `translate(${delta.x}px, ${delta.y + 8}px)`,
              opacity: 0,
            },
            { transform: "none", opacity: 1 },
          ],
          { duration, easing: ease, fill: "backwards" },
        ),
      ],
    },
  },
};
```

- **Motion:** `animate` replaces the `enter`, `persist` or `exit` hooks of a
  kind, `"text"` for plain text. A hook it leaves out keeps the default.
- **Matching:** `fold(char)` makes letters with the same key match, so
  `(c) => c.toLowerCase()` ignores case. `maxShift` is the farthest, in
  characters, a word can move and stay the same word; further, it leaves and
  arrives.
- **Segmentation:** `whole(value, ctx)` cuts the entire value itself, in place
  of the word-by-word diff. `letters: true` draws plain text a box per letter.
  `claim(word)` and `segment(word, ctx)` take over whole words. Mint IDs with `ctx.id()`, and give segments a `kind` to move them with
  hooks of your own under `kinds`.
- **Context:** a hook gets its `index` among the boxes on its side, how many
  are `arriving` and `leaving`, what a staying box `was`, and the box an
  arriving one `replaces`.
  An earlier plugin's hooks come before a later one's, the classic set's included. `decorate` hooks run alongside whatever moves a box.
- **Over time:** `tween(from, to)` returns values to pass through on the way,
  each morphed in turn; a reader hears only the destination, and the callbacks
  fire once. An endless animation is ambient: a morph never waits on it.
- **At rest:** text is plain text between morphs, so boxes and their styles
  exist only while something moves. `boxes(value)` keeps a value in boxes at
  rest, for a plugin that styles or moves them there.
- **Leaving text:** `linger` keeps leaving text in the line for that many
  durations, so new text lands after it, before the line closes up.
- **Settling:** return the animations, or a promise, that a hook starts. The
  morph completes once they settle, and a leaving box is removed for you.
  Anything that isn't a Web Animation should stop when `ctx.signal` aborts,
  which happens when the next morph interrupts.
- **Easing:** a plugin's `ease` becomes the morph's when the component sets
  none, so blur's spring times every letter, moving ones included.
- **Reads and writes:** hooks only write. Measure in `read`, which runs once per
  morph before anything changes, and use what the context hands over.

The full interface is in [docs/plugins.md](https://github.com/lochie/torph/blob/main/docs/plugins.md),
and the three plugins above are short enough to read as examples.

### Debugging a plugin

```ts
import { enableDebug } from "torph/debug";

enableDebug();
```

With `debug` on, a hook that reads layout then logs a warning naming the plugin
and the hook.

## API

### Options

All components accept the following props/options:

- `text` / `children: string` - The text to display (required)
- `duration?: number` - Animation duration in milliseconds (default: `400`).
  Ignored when `ease` is a spring, which settles on its own physics
- `ease?: string | SpringParams` - CSS easing function or spring parameters (default: `"cubic-bezier(0.19, 1, 0.22, 1)"`)
- `plugins?: TorphPlugin[]` - Plugins that change how text is cut up and how it
  moves, earlier ones first. Replaces torph's own set, `classic()`, which runs
  when this isn't set (see [Plugins](#plugins))
- `decimals?: number` - Fraction digits to format a numeric value to. Applies
  when the value is a number (React children, or `update(number)`); ignored for
  strings
- `locale?: Intl.LocalesArgument` - Locale for text segmentation, and for
  formatting a numeric value (default: `"en"`)
- `debug?: boolean` - Enable debug mode with visual indicators
- `disabled?: boolean` - Disable all morphing animations (default: `false`)
- `respectReducedMotion?: boolean` - Respect user's prefers-reduced-motion setting (default: `true`)
- `onAnimationStart?: () => void` - Callback fired when animation begins
- `onAnimationComplete?: () => void` - Callback fired when animation completes
- `onAnimationCancel?: () => void` - Callback fired when a morph is interrupted by the next one. Exactly one of `onAnimationComplete` and `onAnimationCancel` runs per morph
- `className?: string` - CSS class name (React/Vue: `class`)
- `style?: object | string` - Inline styles
- `as?: string` - HTML element type (default: `"span"`)

### Multi-line text

Newlines in a value are rendered as line breaks, and text morphs normally
across them. The React component includes them in its server-rendered markup;
Vue and Svelte render them once the component mounts.

### Utilities

The text matching torph runs on is exported for building your own behaviour on
top of it:

- `segmentText(value, locale): Segment[]` - Split a value into segments
- `diffSegments(oldSegments, newText, locale): DiffResult` - Match a new value
  against existing segments, returning the segments that persist, enter and
  exit

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
