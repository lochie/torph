// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { transitionContainerSize } from "../animate";
import { parseEasing, slopeAt } from "../easing";
import { spring } from "../spring";

const EASE = spring({ stiffness: 150, damping: 19, mass: 1.2 });
const FRAME = 1000 / 60;

class StubAnimation {
  onfinish: (() => void) | null = null;
  currentTime: number | null = 0;
  cancel() {
    this.currentTime = null;
  }
}

/**
 * happy-dom has no layout and no timeline, so both are stood up by hand: the size the
 * element would report, and a clock the transition reads its own progress from. What is
 * under test is what gets handed to the next animation — the keyframes, the easing, and
 * how far into the curve it is started.
 */
function stage(width: number) {
  const element = document.createElement("div");
  document.body.appendChild(element);

  const easings: string[] = [];
  const frames: Record<string, string>[][] = [];
  const running: StubAnimation[] = [];

  element.animate = ((
    keyframes: Record<string, string>[],
    options: { easing: string },
  ) => {
    easings.push(options.easing);
    frames.push(keyframes);
    const anim = new StubAnimation();
    running.push(anim);
    return anim;
  }) as unknown as HTMLElement["animate"];

  const reported = { width, height: 20 };
  globalThis.getComputedStyle = (() => ({
    width: `${reported.width}px`,
    height: `${reported.height}px`,
  })) as unknown as typeof globalThis.getComputedStyle;

  let clock = 0;
  performance.now = () => clock;

  return {
    element,
    reported,
    easings,
    frames,
    running,
    at: (ms: number) => {
      clock = ms;
    },
    /** The width animation of the most recent transition. */
    last: () => ({
      easing: easings[easings.length - 2]!,
      keyframes: frames[frames.length - 2]!,
      seek: Math.round(Number(running[running.length - 2]!.currentTime)),
    }),
    morph: (from: number) =>
      transitionContainerSize(element, from, 20, EASE.duration, EASE.easing),
  };
}

const realStyle = globalThis.getComputedStyle;
const realNow = performance.now;
afterEach(() => {
  globalThis.getComputedStyle = realStyle;
  performance.now = realNow;
  document.body.innerHTML = "";
});

describe("a container size transition", () => {
  it("uses the author's easing when there is nothing in flight", () => {
    const stub = stage(86);
    stub.morph(67);

    // Width and height, in that order.
    expect(stub.easings).toEqual([EASE.easing, EASE.easing]);
    expect(stub.frames[0]).toEqual([{ width: "67px" }, { width: "86px" }]);
  });

  it("starts a moved target over, from where the box actually is", () => {
    const stub = stage(86);
    stub.morph(67);

    stub.reported.width = 140;
    stub.at(FRAME);
    stub.morph(70);

    expect(stub.last().keyframes).toEqual([
      { width: "70px" },
      { width: "140px" },
    ]);
  });
});

/**
 * The dial, frame by frame. Tabular figures make every value from $100 to $150 the same
 * width, so one unmoved transition is replaced every frame while the box still has 19px
 * to cover. Elapsed has to accumulate across those replacements, or the curve never
 * gets past its opening sliver and the box crawls while the text races ahead.
 */
describe("a transition replaced once a frame", () => {
  it("resumes the curve in flight rather than restarting it", () => {
    const stub = stage(86);
    stub.morph(67);

    stub.at(FRAME);
    stub.morph(67.3);

    const { easing, keyframes, seek } = stub.last();
    expect(easing).toBe(EASE.easing);
    // The original start and target, not the box's current width.
    expect(keyframes).toEqual([{ width: "67px" }, { width: "86px" }]);
    expect(seek).toBe(17);
  });

  it("accumulates elapsed across every replacement", () => {
    const stub = stage(86);
    stub.morph(67);

    const seeks: number[] = [];
    for (let frame = 1; frame <= 6; frame += 1) {
      stub.at(frame * FRAME);
      stub.morph(67);
      seeks.push(stub.last().seek);
    }

    expect(seeks).toEqual([17, 33, 50, 67, 83, 100]);
  });

  it("stops resuming once the curve has run its length", () => {
    const stub = stage(86);
    stub.morph(67);

    stub.at(EASE.duration + 1);
    stub.morph(80);

    expect(stub.last().keyframes).toEqual([
      { width: "80px" },
      { width: "86px" },
    ]);
  });

  it("stops resuming across a teardown that cancelled the animation", () => {
    const stub = stage(86);
    stub.morph(67);
    stub.running.forEach((anim) => anim.cancel());

    stub.at(FRAME);
    stub.morph(80);

    expect(stub.last().keyframes).toEqual([
      { width: "80px" },
      { width: "86px" },
    ]);
    expect(stub.last().easing).toBe(EASE.easing);
  });
});

describe("momentum through a target that moves mid-flight", () => {
  it("leaves at the speed it was already travelling", () => {
    const stub = stage(100);
    stub.morph(60);

    // Interrupted a frame in, with only a little left to cover — moving fast relative
    // to what remains, which is the case a fresh curve would depart too slowly for.
    stub.at(FRAME);
    stub.reported.width = 105;
    stub.morph(100);

    const carried = stub.last().easing;
    expect(carried).not.toBe(EASE.easing);
    expect(carried.startsWith("linear(")).toBe(true);

    const carriedFn = parseEasing(carried)!;
    const baseFn = parseEasing(EASE.easing)!;
    expect(carriedFn(0)).toBeCloseTo(0, 4);
    expect(carriedFn(1)).toBeCloseTo(1, 4);
    expect(slopeAt(carriedFn, 0)).toBeGreaterThan(slopeAt(baseFn, 0) * 2);
  });
});
