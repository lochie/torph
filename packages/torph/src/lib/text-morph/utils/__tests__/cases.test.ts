import { describe, it, expect } from "vitest";
import { CASES } from "@torph/test-cases";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";

/**
 * Runs the shared case corpus against the source build.
 *
 * The same cases are rendered and re-run at `/playground/tests` against the
 * bundled package, where they also pick up DOM, jump, and perf checks that need
 * a real browser. Cases live in `packages/test-cases` — add them there, not
 * here, and both surfaces get them.
 */
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
