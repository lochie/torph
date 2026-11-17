import type { Segment } from "../utils/types";
export type { Segment } from "../utils/types";
import type { SpringParams } from "../utils/spring";
import type { AnimationState } from "../utils/animate";
import type { IdAllocator } from "./utils/segment";

export type ClaimContext = { locale: Intl.LocalesArgument };

export type WholeContext = ClaimContext & {
  /** The value's segments as they were, before this change. */
  previous: Segment[];
  /** Pass a base for a derived ID, omit it for a fresh one. */
  id(base?: string): string;
};

export type SegmentContext = ClaimContext & {
  /** The old word this one was paired with, as rendered. Absent for a fresh word. */
  previous?: Segment[];
  /** `previous` cut to one segment per character; the engine splits those boxes in the DOM. */
  split(): Segment[];
  /** Pass a base for a derived ID, omit it for a fresh one. */
  id(base?: string): string;
  /** Caret position within this word, when the value has a single claimed word. */
  cursor?: number;
};

export type MotionContext<State> = {
  /** From the box's `torph-kind`; `"text"` for plain text. */
  kind: string;
  /** The inner box for a slot, else the box itself. */
  mover: HTMLElement;
  delta: { x: number; y: number };
  /** Where the box and mover were when this morph interrupted them. */
  from?: AnimationState;
  moverFrom?: AnimationState;
  line: { height: number };
  state: State;
  duration: number;
  ease: string;
  /** Aborts when a later morph interrupts this one, or the instance is torn down. */
  signal: AbortSignal;
  /** This box's place, in reading order, among the boxes on its side: arriving, staying or leaving. */
  index: number;
  /** How many boxes arrive and leave in this morph. */
  arriving: number;
  leaving: number;
  /** Where the box rests in the root, in layout px; a leaving box, where it stood. */
  at?: { x: number; y: number; width: number };
  /** How wide the value is, old and new together. */
  extent: { width: number };
  /** What this box read before the morph; a staying box can change its text. */
  was?: string;
  /** The leaving box this one takes the place of, between the same unchanged neighbours. */
  replaces?: HTMLElement;
  /** The arriving box that takes this one's place. */
  replacedBy?: HTMLElement;
};

/** What the engine waits on before the morph completes; an exit's box is removed once it settles. */
export type Motion = Animation[] | Promise<unknown> | void;

export type Hooks<State> = {
  enter(box: HTMLElement, ctx: MotionContext<State>): Motion;
  /** Not called for a box that neither moved nor changed its text: its running motion carries on. */
  persist(box: HTMLElement, ctx: MotionContext<State>): Motion;
  exit(box: HTMLElement, ctx: MotionContext<State>): Motion;
};

export type HookSet<State> = Partial<Hooks<State>>;

export type RunContext<State> = {
  /** Each box's rect on screen, read by the engine: a run's shape is a read, and hooks only write. */
  rects: DOMRect[];
  /** Where each box was when this morph interrupted it. */
  from: (AnimationState | undefined)[];
  line: { height: number };
  state: State;
  duration: number;
  ease: string;
  signal: AbortSignal;
};

export type RunHooks<State> = {
  /** Every box in `run` is entering, or every one leaving, with no survivor between. Claimed with no hook for `side`, the run goes back to its boxes' own hooks. */
  claim(run: Segment[], side: "enter" | "exit"): boolean;
  enter?(boxes: HTMLElement[], ctx: RunContext<State>): Motion;
  exit?(boxes: HTMLElement[], ctx: RunContext<State>): Motion;
};

export type KindSpec<State> = HookSet<State> & {
  /** An outer box for FLIP and an inner one for the plugin's own motion. */
  slot?: boolean;
};

export type TorphPlugin<State = unknown> = {
  /** Namespaces the plugin's IDs and tokens; no NULL. */
  name: string;
  /** Serialisable options; a wrapper recreates the morph when it changes. */
  key?: string;
  /** Letters that fold to the same key match, and keep their box: `(c) => c.toLowerCase()` ignores case. */
  fold?(char: string): string;
  /** Values to morph through on the way, each `at` ms from the change; the last should be `to`. */
  tween?(
    from: string,
    to: string,
    ctx: { duration: number },
  ): { value: string; at: number }[] | null;
  /** Runs when the morph is set up on its root, for as long as it lives; return a cleanup. */
  mount?(root: HTMLElement): (() => void) | void;
  /** Cuts the whole value itself, in place of the word-by-word diff. Return null to leave it to the diff. */
  whole?(value: string, ctx: WholeContext): Segment[] | null;
  /** Keeps `value` in boxes at rest, rather than plain text, for a plugin that styles or moves them there. */
  boxes?(value: string): boolean;
  /** How long leaving text keeps its place in the line, as a multiple of the duration, before it goes. */
  linger?: number;
  /** The farthest, in characters, a word moves and stays the same word; further, it leaves and arrives. */
  maxShift?: number;
  /** The morph's ease when the author doesn't choose one. */
  ease?: string | SpringParams;
  /** Draws plain text a box per letter rather than per word, so every letter moves on its own. */
  letters?: boolean;
  /** Whether a value could hold a word this plugin claims. Gates `read` and the diff's fast path. */
  touches?(value: string): boolean;
  claim?(word: string, ctx: ClaimContext): boolean;
  segment?(word: string, ctx: SegmentContext): Segment[];
  /** LCS identity; words with the same token pair positionally. */
  token?(word: string): string;
  /** 0–1, or null to defer to character similarity. Asked of every pair, claimed or not. */
  affinity?(from: string, to: string): number | null;
  /** Once per morph, before anything changes; `change` is the text on screen and the text it becomes. */
  read?(
    root: HTMLElement,
    style: CSSStyleDeclaration,
    change: { from: string; to: string },
  ): State;
  /** Before the "before" measure, so both FLIP measures see it. */
  prepare?(root: HTMLElement, state: State): void;
  teardown?(root: HTMLElement): void;
  css?: string;
  /** Initial state, for a morph where `read` was skipped. */
  idle?: State;
  kinds?: Record<string, KindSpec<State>>;
  /** Moves a wholly replaced run as one shape, in place of its boxes' own hooks. */
  runs?: RunHooks<State>;
  /** Hooks for kinds this plugin doesn't own: `"text"` for plain text, or another plugin's. */
  animate?: Record<string, HookSet<State>>;
  /** Hooks that run alongside whichever moves a box, for a kind or `"*"` for every kind. */
  decorate?: Record<string, Partial<Hooks<State>>>;
};

// A plugin's State is private to it, so the engine holds them all as unknown.
export type AnyPlugin = TorphPlugin<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// `\u0000p` is off text IDs by the NULL, and off `\u0000l` (ligatures) and `\u0000n` (bare `segmentNumber`) by the `p`.
const PREFIX = "\u0000p";
const counters = new Map<string, number>();

/** IDs for one plugin within one segmentation; `alloc` is that segmentation's allocator. */
export function pluginIds(plugin: AnyPlugin, alloc: IdAllocator) {
  const prefix = `${PREFIX}${plugin.name}\u0000`;
  return (base?: string): string => {
    if (base === undefined) {
      // Climbs for good, so it can't meet an ID a box still carries from an earlier morph.
      const n = counters.get(plugin.name) ?? 0;
      counters.set(plugin.name, n + 1);
      return alloc.take(`${prefix}${n}`);
    }
    return alloc.take(`${prefix}${base.replaceAll("\u0000", "")}`);
  };
}

export function claimant(
  plugins: readonly AnyPlugin[],
  word: string,
  ctx: ClaimContext,
): AnyPlugin | undefined {
  return plugins.find((plugin) => plugin.segment && plugin.claim?.(word, ctx));
}

/** Kind to the plugin that emits it. */
export function kindOwners(plugins: readonly AnyPlugin[]) {
  const owners = new Map<string, AnyPlugin>();
  for (const plugin of plugins) {
    for (const kind of Object.keys(plugin.kinds ?? {}))
      owners.set(kind, plugin);
  }
  return owners;
}
