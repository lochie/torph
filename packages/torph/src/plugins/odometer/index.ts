import type {
  KindSpec,
  MotionContext,
  TorphPlugin,
} from "../../lib/text-morph/plugin";

// A figure, with a few affix characters either side: "$1,299", "42%", "-3.5".
const FIGURE = /^[^\d\s]{0,3}\d[\d.,:'\u00A0\u202F]*[^\d\s]{0,3}$/;
// Prefix, the run from the first digit to the last, suffix.
const PARTS = /^(\D*)(\d(?:.*\d)?)(\D*)$/u;

const parts = (text: string) => {
  const [, before = "", core = "", after = ""] = PARTS.exec(text) ?? [];
  return [before, core, after].map((part) => Array.from(part));
};

/** Pairs `next` with `old` place for place, from the left or, for figures, from the right. */
function align<T>(next: string[], old: T[], fromRight: boolean) {
  const shift = fromRight ? old.length - next.length : 0;
  return next.map((_, i) => old[i + shift]);
}

/** Slides the box from where it was, as any staying box does. */
function slide(
  box: HTMLElement,
  { delta, from, duration, ease }: MotionContext<unknown>,
) {
  const x = delta.x + (from?.tx ?? 0);
  const y = delta.y + (from?.ty ?? 0);
  if (!x && !y) return [];
  return [
    box.animate(
      [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }],
      { duration, easing: ease, fill: "backwards" },
    ),
  ];
}

// A wheel's kind carries the way its figure went, so every hook can see it.
const UP = "wheel-up";
const DOWN = "wheel-down";

/** Which way every wheel of a figure turns: with its value, or always one way. */
export type Trend = "auto" | "up" | "down";

/** Turns a wheel from one digit to another, through every digit between, the way the figure went. */
function roll(
  wheel: HTMLElement,
  from: number,
  to: number,
  { kind, line, duration, ease, signal }: MotionContext<unknown>,
) {
  // A turn the last morph left running would hold its end over this one.
  for (const turn of wheel.getAnimations()) turn.cancel();
  const forward = kind === UP;
  const steps = forward ? (to - from + 10) % 10 : (from - to + 10) % 10;
  const digits = Array.from({ length: steps + 1 }, (_, i) =>
    String((from + (forward ? i : -i) + 10) % 10),
  );
  // Counting up, the new digit rises from below; counting down, it drops from above.
  wheel.textContent = (forward ? digits : digits.reverse()).join("\n");
  const far = `translateY(${-steps * line.height}px)`;
  const turn = wheel.animate(
    [
      { transform: forward ? "none" : far },
      { transform: forward ? far : "none" },
    ],
    { duration, easing: ease, fill: "forwards" },
  );
  const settle = () => {
    // Interrupted, the next morph has already put the wheel's digit back.
    if (!signal.aborted) wheel.textContent = String(to);
    turn.cancel();
  };
  signal.addEventListener("abort", () => turn.cancel(), { once: true });
  return turn.finished.then(settle, () => {});
}

/** A figure's value, near enough to tell which way it went: separators dropped, "." kept. */
function value(text: string) {
  const [before = "", core = ""] = PARTS.exec(text)?.slice(1) ?? [];
  const n = Number(core.replace(/[^\d.]/g, "")) || 0;
  return /[-\u2212(]/.test(before) ? -n : n;
}

export type OdometerOptions = {
  /** `"auto"` turns with the value, up as it rises and down as it falls; or always `"up"` or `"down"`. */
  trend?: Trend;
};

/** Figures count like a car's odometer: each place turns through every digit between. */
export function odometer({
  trend = "auto",
}: OdometerOptions = {}): TorphPlugin {
  // A leaving wheel still carries the last morph's kind; the hooks run straight after segment.
  let latest = UP;

  /** The way this figure's wheels turn, carried on their kind so every hook can see it. */
  const direction = (from: string, to: string) =>
    trend === "up" || (trend === "auto" && (!from || value(to) >= value(from)))
      ? UP
      : DOWN;

  const wheel: KindSpec<unknown> = {
    slot: true,
    persist: (box, ctx) => {
      for (const turn of ctx.mover.getAnimations()) turn.cancel();
      const motion = slide(box, ctx);
      const to = ctx.mover.textContent ?? "";
      if (!ctx.was || ctx.was === to || !/\d/.test(ctx.was)) return motion;
      return Promise.all([
        ...motion.map((a) => a.finished),
        roll(ctx.mover, Number(ctx.was), Number(to), ctx),
      ]);
    },
    // A new place, as the figure grows, turns from zero.
    enter: (_box, ctx) =>
      roll(ctx.mover, 0, Number(ctx.mover.textContent), ctx),
    // A place the figure loses leaves the way the wheels turn.
    exit: (_box, { mover, line, duration }) => [
      mover.animate(
        {
          transform: `translateY(${latest === UP ? -line.height : line.height}px)`,
          opacity: 0,
          offset: 1,
        },
        { duration: duration / 2, fill: "both" },
      ),
    ],
  };

  return {
    name: "odometer",
    key: trend,
    claim: (word) => FIGURE.test(word),
    // The figure lines up from the right, so the ones stay the ones however long it gets;
    // the prefix from the left and the suffix from the right, so "$" stays "$".
    segment: (word, { previous = [], id }) => {
      const kind = (latest = direction(
        previous.map((s) => s.string).join(""),
        word,
      ));
      const next = parts(word);
      const perChar = previous.every((s) => Array.from(s.string).length === 1);
      const old = perChar
        ? parts(previous.map((s) => s.string).join(""))
        : [[], [], []];
      let at = 0;
      const was = old.map((part) => previous.slice(at, (at += part.length)));
      return next.flatMap((chars, p) =>
        align(chars, was[p]!, p > 0).map((kept, i) => ({
          id: kept?.id ?? id(),
          string: chars[i]!,
          kind: /\d/.test(chars[i]!) ? kind : undefined,
        })),
      );
    },
    affinity: (a, b) => (FIGURE.test(a) && FIGURE.test(b) ? 1 : null),
    // A wheel is one line tall, with the rest of its digits clipped above and below.
    css: `
[torph-kind^="wheel-"] { clip-path: inset(0 -100vw); }
[torph-kind^="wheel-"] > span { display: inline-block; vertical-align: top; height: 1lh; white-space: pre; }
`,
    kinds: { [UP]: wheel, [DOWN]: wheel },
  };
}
