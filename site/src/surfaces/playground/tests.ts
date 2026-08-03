import { segmentText, diffSegments } from "torph";
import { CASES, ALL_TAGS } from "@torph/test-cases";
import type { Result, TestCase, TorphApi } from "@torph/test-cases";

// Cases live in `packages/test-cases`, shared with the vitest suite. This only
// binds them to the bundled package.
export const torph: TorphApi = { segmentText, diffSegments };

export type BenchCase = Omit<TestCase, "verify"> & { verify: () => Result };

export const TESTS: BenchCase[] = CASES.map((testCase) => ({
  ...testCase,
  verify: () => testCase.verify(torph),
}));

export { ALL_TAGS };
