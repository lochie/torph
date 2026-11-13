// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { detachFromFlow } from "../dom";

describe("lifting an exit out of the flow", () => {
  it("pins the border box where it was, whatever its margins", () => {
    const root = document.createElement("span");
    const item = document.createElement("span");
    // A padded slot pulled back into its line by an equal negative margin.
    item.style.padding = "10px 0";
    item.style.margin = "-10px 0 -10px 4px";
    root.append(item);
    document.body.append(root);

    detachFromFlow(root, [item]);

    // happy-dom has no layout, so offsets are 0 and only the margins remain.
    expect(item.style.top).toBe("10px");
    expect(item.style.left).toBe("-4px");
    root.remove();
  });

  it("leaves from the opacity and scale it had reached, not its final state", () => {
    const root = document.createElement("span");
    const item = document.createElement("span");
    // A word caught early in its arrival: still transparent, still scaled down.
    item.style.opacity = "0";
    item.style.transform = "matrix(0.95, 0, 0, 0.95, 3, 4)";
    root.append(item);
    document.body.append(root);

    detachFromFlow(root, [item]);

    expect(item.style.opacity).toBe("0");
    // The translation is folded into the position; only the scale stays a transform.
    expect(item.style.left).toBe("3px");
    expect(item.style.top).toBe("4px");
    expect(item.style.transform).toBe("matrix(0.95, 0, 0, 0.95, 0, 0)");
    root.remove();
  });
});
