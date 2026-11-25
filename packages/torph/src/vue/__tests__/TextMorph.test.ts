// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { createApp, h, nextTick, reactive, type App } from "vue";
import { TextMorph as Morph } from "../../lib/text-morph";
import TextMorph from "../TextMorph";

const durations: unknown[] = [];
const destroy = vi.spyOn(Morph.prototype, "destroy");

beforeAll(() => {
  const original = Element.prototype.animate;
  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    durations.push((options as { duration?: unknown } | undefined)?.duration);
    const animation = original.call(this, keyframes as never, options as never);
    animation.finished?.catch(() => {});
    return animation;
  } as typeof Element.prototype.animate;
});

let app: App | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  destroy.mockClear();
  durations.length = 0;
  document.body.innerHTML = "";
});

// Two ticks: the component's watchers, then the queued morph's microtask.
const settled = async () => {
  await nextTick();
  await Promise.resolve();
};

describe("Vue TextMorph", () => {
  it("changes options on the live morph rather than rebuilding it", async () => {
    const props = reactive({
      text: "hello",
      duration: 300,
      ease: "ease",
      debug: false,
      respectReducedMotion: false,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    app = createApp({ render: () => h(TextMorph, props) });
    app.mount(container);
    await settled();

    Object.assign(props, { duration: 900, ease: "ease-in", debug: true });
    await settled();
    expect(destroy).not.toHaveBeenCalled();

    durations.length = 0;
    props.text = "hello world";
    await settled();
    expect(durations).toContain(900);
    expect(durations).not.toContain(300);
  });
});
