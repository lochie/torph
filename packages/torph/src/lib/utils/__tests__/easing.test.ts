import { describe, it, expect } from "vitest";
import { parseEasing, slopeAt } from "../easing";
import { carry, sampleEasing } from "../animate";
import { spring } from "../spring";

const DEFAULT_EASE = "cubic-bezier(0.19, 1, 0.22, 1)";
const CARRY_MAX = 8; // mirrors animate.ts

describe("reading a CSS easing", () => {
  it("parses the keywords, cubic-bezier and linear", () => {
    for (const ease of [
      "ease",
      "ease-in-out",
      DEFAULT_EASE,
      "linear(0, 0.5, 1)",
      "linear(0, 0.25 40%, 1)",
    ]) {
      const fn = parseEasing(ease)!;
      expect(fn, ease).toBeTypeOf("function");
      expect(fn(0)).toBeCloseTo(0, 4);
      expect(fn(1)).toBeCloseTo(1, 4);
    }
  });

  it("gives up on what it cannot differentiate, rather than guessing", () => {
    for (const ease of ["steps(4, end)", "var(--ease)", "wobble(2)", ""]) {
      expect(parseEasing(ease), ease).toBeNull();
    }
  });

  it("interpolates a linear() between its stops", () => {
    const fn = parseEasing("linear(0, 1)")!;
    expect(fn(0.25)).toBeCloseTo(0.25, 4);
    expect(slopeAt(fn, 0.5)).toBeCloseTo(1, 2);
  });

  // Why the dial showed this and a default-eased value barely did. The spring figure
  // is the first chord of the sampled linear(), which is what the browser really runs.
  it("finds the default ease front-loaded and a spring leaving far slower", () => {
    const bezier = slopeAt(parseEasing(DEFAULT_EASE)!, 0);
    const springy = slopeAt(parseEasing(spring({ stiffness: 150 }).easing)!, 0);
    expect(bezier).toBeGreaterThan(4);
    expect(springy).toBeLessThan(bezier / 3);
  });
});

describe("carrying momentum through an interrupt", () => {
  const base = parseEasing(DEFAULT_EASE)!;

  it("leaves a curve that already starts faster alone", () => {
    expect(carry(base, 0).k).toBe(0);
    expect(carry(base, 1).k).toBe(0);
    expect(carry(base, -3).k).toBe(0);
    expect(carry(base, 0).curve).toBe(base);
  });

  // A NaN here reaches the browser as `linear(NaN, ...)`, which throws on animate().
  // An infinity is only a velocity past the clamp, and clamps like any other.
  it("refuses a velocity that is not a number", () => {
    expect(carry(base, NaN).k).toBe(0);
    expect(carry(base, NaN).curve).toBe(base);
    expect(carry(base, Infinity).k).toBeCloseTo(carry(base, CARRY_MAX).k, 6);
    expect(carry(base, -Infinity).k).toBe(0);

    for (const velocity of [NaN, Infinity, -Infinity]) {
      const values = sampleEasing(carry(base, velocity).curve, 400)
        .slice(7, -1)
        .split(",")
        .map(Number);
      expect(values.every(Number.isFinite), `v=${velocity}`).toBe(true);
    }
  });

  it("leaves at the carried speed without moving either end", () => {
    const { curve } = carry(base, 8);
    expect(curve(0)).toBeCloseTo(0, 4);
    expect(curve(1)).toBeCloseTo(1, 4);
    expect(slopeAt(curve, 0)).toBeCloseTo(8, 1);
  });

  // A bouncy spring already overshoots on its own; what the carry adds is the part
  // this bounds, so a fast interrupt cannot turn a settle into a lurch.
  it("adds no more than a tenth of the distance to the overshoot", () => {
    const peak = (curve: (t: number) => number) => {
      let highest = 0;
      for (let t = 0; t <= 1; t += 0.001) highest = Math.max(highest, curve(t));
      return highest;
    };

    for (const ease of [DEFAULT_EASE, spring().easing]) {
      const parsed = parseEasing(ease)!;
      for (const velocity of [2, 5, 8, 40]) {
        const added = peak(carry(parsed, velocity).curve) - peak(parsed);
        expect(added, `${ease} v=${velocity}`).toBeLessThan(0.12);
      }
    }
  });

  it("samples to a linear() fine enough to be sub-frame", () => {
    const easing = sampleEasing(carry(base, 8).curve, 400);
    expect(easing.startsWith("linear(")).toBe(true);
    const values = easing.slice(7, -1).split(",").map(Number);
    expect(values.length).toBeGreaterThanOrEqual(32);
    expect(values[0]).toBeCloseTo(0, 4);
    expect(values[values.length - 1]).toBe(1);
  });
});

/**
 * The bug this exists for: a value updated faster than the morph settles restarts the
 * size curve every frame, so only its opening sliver ever plays and the box trails the
 * text. Replays that against the real curves — a dial spun a digit per frame.
 */
describe("a container size interrupted every frame", () => {
  const width = (value: number) => 10 + `$${value}`.length * 19;
  const FRAME = 1000 / 60;

  const spin = (ease: string, duration: number, carryOn: boolean) => {
    const base = parseEasing(ease)!;
    let position = width(90);
    let curve = base;
    let from = position;
    let to = position;
    let elapsed = 0;

    for (let frame = 0; frame <= 60; frame += 1) {
      const target = width(90 + frame);
      const velocity = carryOn
        ? ((to - from) * slopeAt(curve, elapsed / duration)) / duration
        : 0;

      from = position;
      to = target;
      const delta = to - from;
      curve =
        carryOn && Math.abs(delta) > 0.5
          ? carry(base, (velocity * duration) / delta).curve
          : base;

      elapsed = FRAME;
      position = from + delta * curve(elapsed / duration);
    }
    return to - position;
  };

  it("closes the gap a spring leaves open", () => {
    const { easing, duration } = spring({
      stiffness: 150,
      damping: 19,
      mass: 1.2,
    });
    expect(spin(easing, duration, false)).toBeGreaterThan(2);
    expect(spin(easing, duration, true)).toBeLessThan(0.5);
  });

  it("does not make the front-loaded default any worse", () => {
    const before = spin(DEFAULT_EASE, 400, false);
    const after = spin(DEFAULT_EASE, 400, true);
    expect(after).toBeLessThanOrEqual(before + 0.01);
  });
});
