# Plugins

Design for a plugin interface: how someone outside the repo changes how text is cut up and how it moves.

Status: implemented. All five steps of the order of work are done; the sections below record the design as it was decided and what changed on the way.

## Goals

- **Easy to extend.** A plugin that only changes an animation, or only changes segmentation, is a few dozen lines and touches no engine code.
- **Numbers are a plugin.** The number morph moves onto this interface and stays on by default. If numbers can't be expressed without special cases left in the engine, the interface is wrong.
- **The engine's guarantees survive.** Unique segment IDs, the read/write split, and settling with exactly one of complete/cancel hold for every plugin, without each plugin author having to know about them.

Not a goal: bundle size. Numbers stay in core. A user-written plugin ships in the user's own bundle.

## Shape

A plugin is a plain object, usually returned by a factory so it can take options:

```ts
type TorphPlugin<State = unknown> = {
  /** Namespaces the plugin's IDs and tokens. No NULL characters. */
  name: string;
  /** Serialisable options. Wrappers recreate the morph when it changes. */
  key?: string;

  // Segmentation: word-level
  claim?(word: string, ctx: ClaimContext): boolean;
  segment?(word: string, ctx: SegmentContext): Segment[];
  /** LCS identity. Words with the same token pair positionally. */
  token?(word: string): string;
  /** 0–1. How strongly an unmatched old word should become this one. */
  affinity?(from: string, to: string): number | null;

  /** Plain text is drawn a box per letter rather than per word. */
  letters?: boolean;
  /** The morph's ease when the author sets none. Blur uses it for its spring. */
  ease?: string | SpringParams;
  /** Whether a value could hold a word this plugin claims. Gates `read` and the diff's fast path. */
  touches?(value: string): boolean;

  // Read phase: once per morph, before any write
  read?(root: HTMLElement, style: CSSStyleDeclaration): State;

  // Write phase
  /** Before the engine's "before" measure, so both FLIP measures see it. */
  prepare?(root: HTMLElement, state: State): void;
  /** Undoes `prepare` when the instance is destroyed. */
  teardown?(root: HTMLElement): void;
  /** The state for a morph where `read` was skipped. */
  idle?: State;
  css?: string;
  /** Kinds this plugin emits, and how each one is drawn and moved. */
  kinds?: Record<string, KindSpec<State>>;
  /** Replaces the hooks of kinds it doesn't own: "text", or another plugin's. */
  animate?: Record<string, Partial<Hooks<State>>>;
  /** Moves a wholly replaced run of boxes as one shape, in place of their own hooks. */
  runs?: RunHooks<State>;
};

type KindSpec<State> = Partial<Hooks<State>> & {
  /** An outer box for FLIP and an inner one for the plugin's own motion. */
  slot?: boolean;
};

type RunHooks<State> = {
  claim(run: Segment[], side: "enter" | "exit"): boolean;
  enter?(boxes: HTMLElement[], ctx: RunContext<State>): Motion;
  exit?(boxes: HTMLElement[], ctx: RunContext<State>): Motion;
};

type Hooks<State> = {
  enter(box: HTMLElement, ctx: MotionContext<State>): Motion;
  persist(box: HTMLElement, ctx: MotionContext<State>): Motion;
  exit(box: HTMLElement, ctx: MotionContext<State>): Motion;
};

/** What the engine waits on before the morph completes. */
type Motion = Animation[] | Promise<void> | void;
```

The contexts:

```ts
type ClaimContext = { locale: Intl.LocalesArgument };

type SegmentContext = ClaimContext & {
  /** The old word this one was paired with, as rendered. Absent on first render or a fresh word. */
  previous?: Segment[];
  /** `previous` cut to one segment per character. The engine splits those boxes in the DOM. */
  split(): Segment[];
  /** A collision-free ID in this plugin's namespace. Pass a base for derived IDs, omit it for a fresh one. */
  id(base?: string): string;
  /** Caret position within this word, when the value has a single claimed word. */
  cursor?: number;
};

type MotionContext<State> = {
  /** From the box's `torph-kind`: an exit's segment is already gone. */
  kind: string;
  /** The inner box for a slot, else `box`. */
  mover: HTMLElement;
  /** FLIP offset from the box's old position, already including any interrupted motion. */
  delta: { x: number; y: number };
  /** Where the box and mover were when this morph interrupted them. */
  from: AnimationState;
  moverFrom: AnimationState;
  /** One line box, measured by the engine. */
  line: { height: number };
  state: State;
  duration: number;
  ease: string;
  /** Aborts when a later morph interrupts this one or the instance is torn down. */
  signal: AbortSignal;
};

type RunContext<State> = Omit<
  MotionContext<State>,
  "segment" | "mover" | "delta"
> & {
  segments: Segment[];
  /** Each box's rect, measured by the engine: a run's shape is a read, and hooks may not read. */
  rects: DOMRect[];
  from: AnimationState[];
};
```

Usage:

```ts
new TextMorph({ element, plugins: [blur()] });
<TextMorph plugins={[words(), blur({ amount: "0.2em" })]}>{label}</TextMorph>
```

`plugins` replaces torph's default set, `classic()` (`numbers()`, `groups()`, `fade()`, `scale()`), which runs when it isn't set. Adding to it is `[blur(), ...classic()]`; dropping numbers is the set without `numbers()`; `[]` is the engine alone, where staying text slides, arriving text appears and leaving text goes.

## How the engine runs plugins

### Segmentation

The engine segments as it does today with `Intl.Segmenter`, then regroups the result into whitespace-delimited words, as `expandNumbers` does in [segment.ts](../packages/torph/src/lib/text-morph/utils/segment.ts). For each word, the first plugin whose `claim` returns true calls `segment` for it. Unclaimed words keep the engine's own segments, which have the `"text"` kind.

Order is the list's. Put a plugin before `numbers()` and it can claim words numbers would have taken.

The diff ([diff.ts](../packages/torph/src/lib/text-morph/utils/diff.ts)) generalises its four number touch-points:

| today                                                  | becomes                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `NUMBER_TOKEN` collapses every number to one LCS token | `token(word)` from the claiming plugin                               |
| `pairAffinity` scores matching numeric skeletons as 1  | `affinity(from, to)`, falling back to character similarity on `null` |
| `mode: "number"` re-segments against the old word      | `mode: "plugin"`: `segment(word, { previous, split })`               |
| `cursorIndex` honoured when there's a single number    | `ctx.cursor` when there's a single claimed word                      |

The early return that skips the word pass when no digits are involved becomes "no plugin claims a word in either value".

### IDs

AGENTS.md requires any new ID source to argue its own disjointness. Plugin IDs come only from `ctx.id()`, which issues `\u0000p` + name + `\u0000` + a local part.

- **Text IDs** are derived from the text, and the value never contains NULL, so text IDs can't collide.
- **Ligature IDs** start `\u0000l`, and the number counter `\u0000n` retires once numbers become a plugin. The `p` keeps plugin IDs off both.
- **Two plugins** can't collide because names must be unique and contain no NULL.
- **Within a plugin**, `id(base)` goes through the value's `createIdAllocator()`, and `id()` with no base uses a climbing counter, as `mintId()` does today.

Ligatures join parts with NULL. That join stays unambiguous because a part either contains no NULL (text) or starts with NULL followed by a tag letter.

A `segment` that returns an ID it didn't get from `ctx.id()` or `previous` throws in `debug` mode.

### Phases

Each morph runs in this order:

1. **Read:** the engine's own reads, then every plugin's `read`. No writes.
2. **Prepare:** every plugin's `prepare`. Writes that change layout, such as numbers' ink variables on the root, go here so both FLIP measures include them.
3. **Measure, reconcile, measure:** the engine, unchanged. Slot structure comes from `KindSpec.slot` instead of `segment.kind` being set.
4. **Motion:** replaced runs first, then `exit` for the remaining leaving boxes, then `enter` / `persist` for the rest. Hooks write only, and get every measurement they need through `ctx`.

Calling `enableDebug()` from `torph/debug` turns on hook checks for instances with `debug` on. While a hook runs, `getComputedStyle`, `getBoundingClientRect`, `getClientRects` and the `offset*` / `client*` getters are wrapped, and the first read from a hook logs a warning naming the plugin and hook. The check lives in its own entry so core pays only for looking it up (about 150 B gzip); the check itself is about 500 B.

A hook's lookup goes: the claiming plugin's `kinds[kind]`, then any plugin's `animate[kind]` (last one wins), then the engine's text hooks. Each hook resolves on its own, so a plugin that replaces only `exit` keeps the default `enter` and `persist`.

### Runs

Group replacement becomes a built-in plugin, `groups()`, on by default like numbers.

The engine still finds the runs: maximal stretches of entering, or leaving, boxes with no survivor inside, as `replacedRuns` does in [replace-animate.ts](../packages/torph/src/lib/text-morph/utils/replace-animate.ts). It offers each run to plugins' `runs.claim`, user plugins first. A claimed run's boxes skip their own hooks. An unclaimed run falls through box by box.

`groups()` claims runs of at least `GROUP_MIN` (6) boxes and moves them with `animateGroupEnter` / `Exit`. The threshold moves out of `replacedRuns` and into the plugin's `claim`.

`originsFor` reads `getBoundingClientRect` in the middle of the motion today, so the run's shared origin comes from `ctx.rects` instead. Without that change, the built-in plugin would trip its own debug warning.

### Width

Every box is fitted to its text's own width for the length of a morph, so a plugin that changes a box's content mid-morph doesn't reflow the line. There is nothing to opt into.

### Settling and interruption

A staying box that neither moved nor changed its text is left alone: its `persist` hook isn't called, and whatever it was doing carries on, rather than restarting on every update.

Hooks return what the engine has to wait on. WAAPI animations are already found by `getAnimations({ subtree: true })`. A returned promise covers anything that isn't one, like a rAF loop. The morph completes when both have settled.

When a later morph interrupts, the engine aborts `ctx.signal` before it reconciles. A plugin stops writing when its signal aborts and doesn't restore anything; the next morph's reconcile owns the box's content from then on. On exit, the engine removes the box once its motion settles, so plugins never call `remove()`.

Text at rest is plain text: boxes exist only during a morph. The join waits for these same promises, so a plugin's motion always finishes before its boxes turn back into text, and a plugin's `css` for its boxes only applies mid-morph. A plugin that styles or moves boxes at rest keeps them with `boxes(value)`, which also stops the morph joining text it leaves alone into one box.

### Wrappers

`MorphController.serializeConfig` keys on `JSON.stringify`, which drops functions. It adds `plugins.map((p) => p.name + (p.key ?? ""))`. A new `[blur()]` array on every render then doesn't tear the morph down, and changing `blur({ amount })` does.

## Examples

Each example uses a different part of the interface. These are sketches and haven't been compiled.

### Numbers: every hook (built-in)

How today's code maps onto the interface:

| interface                     | today                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `claim`                       | `isNumericWord`                                                                                                                     |
| `segment`                     | `segmentNumber(word, ctx.split() as previous, ctx.cursor, decimal)`, IDs from `ctx.id()`                                            |
| `token`                       | `() => "#"`                                                                                                                         |
| `affinity`                    | skeleton match → 1, else `null`                                                                                                     |
| `read`                        | `slotClip(style)`                                                                                                                   |
| `prepare`                     | writes `VAR_INK_TOP` / `VAR_INK_BOTTOM`                                                                                             |
| `css`                         | the `[torph-slot]` rules from [styles.ts](../packages/torph/src/lib/utils/styles.ts)                                                |
| `kinds.digit`, `kinds.symbol` | `slot: true`. Hooks are `animateNumberEnter` / `Persist` / `Exit`, with slide distance `ctx.line.height + state.top + state.bottom` |

`decimalSeparator` needs the locale, which `ClaimContext` carries. Once this is done, `index.ts`, `diff.ts` and `segment.ts` shouldn't mention numbers at all.

### Blur: motion, letter by letter

Letters rise into focus from below and blur away upwards, each a share of the duration after the one before. It overrides `"text"`'s `enter` and `exit` and sets `letters`, so a new word arrives a letter at a time rather than as one box. The stagger needs no engine support: each morph has its own `signal`, so blur numbers that morph's letters by counting calls against it. `persist` isn't defined, so moving text keeps the default FLIP. Source: [packages/torph/src/plugins/blur/index.ts](../packages/torph/src/plugins/blur/index.ts).

### Word mode: segmentation only

```ts
export function words(): TorphPlugin {
  return {
    name: "words",
    claim: () => true,
    segment: (word, { id }) => [{ id: id(word), string: word, kind: "word" }],
  };
}
```

A word that changes swaps whole, where torph would otherwise morph the letters it shares with the old one; a new word already arrives as one box either way. There are no `kinds` hooks, so the segment animates as text.

Claiming every word means it beats numbers too, because user plugins go first. Here that's the point. The engine already reuses identical words through the LCS, so `segment` only ever sees new or changed words.

### Scramble: stateful, per-frame motion

```ts
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function scramble(): TorphPlugin {
  return {
    name: "scramble",
    animate: {
      text: {
        enter: (box, { mover, segment, duration, signal }) =>
          new Promise((resolve) => {
            const start = performance.now();
            const tick = (now: number) => {
              if (signal.aborted) return resolve();
              if (now - start >= duration) {
                mover.textContent = segment.string;
                return resolve();
              }
              mover.textContent =
                GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      },
    },
  };
}
```

New characters cycle through random glyphs before landing. This one needs things the other three don't:

- **A promise**, because the engine can't see a rAF loop, so it would complete the morph, or rejoin the text, mid-scramble.
- **An abort signal.** Otherwise an interrupted scramble keeps writing into a box that now belongs to the next morph.
- **Writing only to `mover`**, so a slot box keeps its inner span.
- **A stable width.** The box would change width on every glyph and reflow the line each frame, but the engine already fits every box to its text's width for the length of the morph.

## Flap, typewriter and tokens

- **`flap`** turns each place round a drum to its new letter, and nothing slides. It claims every word and keeps box _i_ for letter _i_, with an `affinity` of 1 so any word pairs with the one in its place. A staying box changes its text, so hooks get `was`, the text it had before the morph.
- **`typewriter`** backspaces from the end, then types. Hooks get their `index` among the boxes on their side and how many are `arriving` and `leaving`, which is all the timing needs. Blur uses the same to spread its stagger.
- **`tokens`** cuts identifiers and paths at their joins and pairs them by shared tokens, where long names share too few letters for the default.

A plugin that claims a replaced run with no hook for it hands the run back to its boxes, so blur, flap and typewriter stay letter by letter where `groups()` would collapse a long run. Arriving and leaving boxes are also paired by the gap they share (`replaces` / `replacedBy`).

## Odometer, wave and caseless

- **`odometer`** claims figures and keeps each place's box, lined up from the right, so a staying digit turns through every digit to its new one. It needs nothing new: `was` already says where to turn from.
- **`wave`** drops letters in on its own bouncing spring, and lets them fall. Nothing new.
- Hook lookup goes plugin by plugin, so an earlier plugin's override comes before a later plugin's own kind.
- **`caseless`** needs the diff's letter matching to ignore case: `fold(char)` keys the matching, and `affinity` pairs words that differ only in case.

Blur also gained `maxShift`: a word that would travel more than three characters leaves and arrives instead of sliding, as the reference effect does, and its stagger fits in 30% of the duration.

## Stack, squash and redline

- **`stack`** draws the whole value as one card. It cuts the entire value itself through `whole(value, ctx)`, which runs in place of the word-by-word diff; the previous IDs are reserved so a fresh one can't collide.
- **`squash`** stretches moving text along its path and squashes it on landing, from the `delta` hooks already get. Nothing new.
- **`redline`** keeps removed words in the line, struck through, while added words arrive after them. `linger` holds leaving boxes in flow for that many durations, then the engine takes them out and closes the line up as its own small morph. A change that arrives sooner takes lingering text out at once, before anything is measured.

## Countup, and endless animations

- **`countup`** counts through the values between. `tween(from, to)` returns timed values; the engine morphs to each in turn, tells a reader only the destination, fires start and complete once for the whole count, and cancels the rest of it when the value changes again.
- An endless animation is ambient: a morph never waits on it, so a plugin's looping CSS can't keep text from settling.

**`redline`** also diffs several lines a line at a time, like code: an unchanged line keeps its boxes, a changed one is matched word by word against the line it replaced, and a removed line keeps its own row, line break included, until the line closes up.

## Rows, trend and reveal

- **`rows`** draws each line as one box, known by a key, so a reordered list slides its rows rather than retyping them. It cuts the whole value and reuses last value's IDs by key: `whole` holds back the previous IDs, so a box only carries over when the plugin hands its ID on.
- **`trend`** flashes what changes green or red with the figure's direction, through `decorate` beside the numbers' own motion. Direction needs the value, so `read` now gets `{ from, to }`, the text on screen and the text it becomes.
- **`reveal`** keeps each place's box and turns it over to its new character, like flap without the drum.
- **`odometer`** takes a colon as a separator, so a clock counts down.

The site gained a countdown, and a demo at the top of the plugins page that stacks any of them, starting from `classic()`.

## Decisions

1. **Group replacement is a plugin.** It becomes `groups()`, a built-in on by default, through the `runs` hooks above. Plugins can claim runs of their own kinds.
2. **The engine owns width.** Every box is fitted to its text for the length of a morph.
3. **Reads from inside hooks warn in `debug`,** once `enableDebug()` from `torph/debug` has been called. Nothing is enforced otherwise.
4. **`Segment.kind` widening to `string` isn't treated as breaking.** `Segment` is exported but undocumented, and undocumented types carry no stability promise.
5. **Claims stay word-level** for the first version.
6. **Examples ship two ways:**
   - **Subpath exports of `torph`,** like `torph/react`: `torph/plugins/blur`, `torph/plugins/words`, `torph/plugins/scramble`. Source in `packages/torph/src/plugins/<name>/`, one tsup entry and one `exports` entry each, versioned and released with the core under the existing changeset. Each entry gets `aliasCorePlugin` too. Anything a plugin imports at runtime has to come through `../lib/text-morph`, or it's inlined into the plugin's bundle. Each entry also goes into the `entries` list in `scripts/bundle-sizes.mjs`.
   - **Site.** A standalone `/plugins` page beside `/examples`: `app/plugins/page.tsx` composing `surfaces/plugins/`, with each demo in its own subfolder (`surfaces/plugins/blur/` and so on). It shows each plugin running next to its source.

## What step 1 changed in the design

- **`touches`.** `read` and the diff's fast path were both gated on "the value has a digit", which is cheaper than claiming each word, and claiming each word would change which values take the fast path. A plugin without it is assumed to touch every value.
- **`teardown` and `idle`.** Numbers writes ink variables on the root that `destroy()` has to remove, and needs a state for morphs where `read` was skipped.
- **`MotionContext.kind`, not `segment`.** An exit's segment is already gone by the time it animates. The kind is read from the box.
- **Kinds aren't namespaced yet.** The corpus pins `"digit" | "symbol"`, and widening `SegmentKind` to `string` waits for step 5. Two plugins can't share a kind: the later one owns it.
- **Deferred:** `Motion` return values and `signal` (step 4, scramble), `runs` (step 2) and the debug read warnings (step 3). Hooks return `void` until then.

## Order of work

1. Move numbers onto an internal version of this interface. No public API, and no behaviour change: the existing corpus and engine tests must pass unchanged.
2. Move group replacement into `groups()` the same way, with run origins from `ctx.rects`.
3. Add the `debug` read warnings. Then steps 1 and 2 are checked by the same rule third-party plugins will be.
4. Build blur, word mode and scramble against it, with the `/plugins` page. Revise the interface wherever any of them needs an engine change.
5. Widen `Segment.kind` to `string`, so a plugin can emit kinds of its own (blocked until now by the corpus's types), and document plugins in the README. The `plugins` option, the wrapper support, the type exports and the `torph/plugins/<name>` entries landed in step 4, under `.changeset/plugins.md`.
