import { describe, it, expect } from "vitest";
import { CASES } from "@torph/test-cases";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";

// Cases live in `packages/test-cases` — adding one there adds it here and to
// the playground.
describe("shared test cases", () => {
  const torph = { segmentText, diffSegments };

  it("has cases to run", () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it.each(CASES.map((c) => [c.label, c] as const))("%s", (_label, testCase) => {
    const { pass, detail } = testCase.verify(torph);
    expect(pass, detail).toBe(true);
  });
});
