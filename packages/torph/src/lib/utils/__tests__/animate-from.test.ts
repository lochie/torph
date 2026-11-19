// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { animateFrom, type Where } from "../animate";

const AT: Where = {
  transform: "matrix(1, 0, 0, 1, 0, 12)",
  transformOrigin: "10px 0px",
  opacity: "0.4",
};

function element() {
  const el = document.createElement("span");
  const animate = vi.fn(
    (..._args: unknown[]) => ({ cancel() {} }) as unknown as Animation,
  );
  el.animate = animate as unknown as typeof el.animate;
  return { el, animate };
}

describe("animateFrom", () => {
  it("starts an interrupted element from where it was", () => {
    const { el, animate } = element();
    animateFrom(new Map([[el, AT]]), el, [
      { transform: "translateY(20px)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ]);
    const [frames] = animate.mock.calls[0] as unknown as [Keyframe[]];
    expect(frames[0]).toMatchObject({
      transform: AT.transform,
      transformOrigin: AT.transformOrigin,
      opacity: AT.opacity,
    });
    expect(frames[1]).toMatchObject({ transform: "none", opacity: 1 });
  });

  it("adds how far the element's layout moved since", () => {
    const { el, animate } = element();
    animateFrom(
      new Map([[el, AT]]),
      el,
      [{ transform: "translate(5px, 5px)" }, { transform: "none" }],
      {},
      { x: 30, y: 0 },
    );
    const [frames] = animate.mock.calls[0] as unknown as [Keyframe[]];
    expect(frames[0]!.transform).toBe(`translate(30px, 0px) ${AT.transform}`);
  });

  it("puts where it was in front of a lone destination", () => {
    const { el, animate } = element();
    animateFrom(new Map([[el, AT]]), el, { opacity: 0, offset: 1 });
    const [frames] = animate.mock.calls[0] as unknown as [Keyframe[]];
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ offset: 0, opacity: AT.opacity });
    expect(frames[0]).not.toHaveProperty("transform");
  });

  it("leaves a fresh element, and an additive animation, as asked", () => {
    const fresh = element();
    const frames = [{ opacity: 0 }, { opacity: 1 }];
    animateFrom(new Map(), fresh.el, frames);
    expect(fresh.animate.mock.calls[0]![0]).toBe(frames);

    const added = element();
    animateFrom(new Map([[added.el, AT]]), added.el, frames, {
      composite: "add",
    });
    expect(added.animate.mock.calls[0]![0]).toBe(frames);
  });
});
