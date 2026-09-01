import { describe, it, expect } from "vitest";
import { NUMBER_CASES } from "@torph/test-cases";
import { segmentNumber } from "../number";

// Cases live in `packages/test-cases` — adding one there adds it here and to
// the playground.
describe("shared number cases", () => {
  const torph = { segmentNumber };

  it("has cases to run", () => {
    expect(NUMBER_CASES.length).toBeGreaterThan(0);
  });

  it.each(NUMBER_CASES.map((c) => [c.label, c] as const))(
    "%s",
    (_label, testCase) => {
      const { pass, detail } = testCase.verify(torph);
      expect(pass, detail).toBe(true);
    },
  );
});
