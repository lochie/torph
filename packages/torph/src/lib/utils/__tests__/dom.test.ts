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
});
