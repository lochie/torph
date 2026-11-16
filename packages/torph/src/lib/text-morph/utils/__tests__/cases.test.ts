import { describe, it, expect } from "vitest";
import { CASES, verifyIdsKeepText } from "@torph/test-cases";
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

  const steps = CASES.flatMap((c) =>
    c.values.slice(1).map((to, i) => [c.label, c.values[i]!, to] as const),
  );

  it.each(steps)(
    "%s: %j → %j keeps every kept ID's text",
    (_label, from, to) => {
      const { pass, detail } = verifyIdsKeepText(torph, from, to);
      expect(pass, detail).toBe(true);
    },
  );
});
