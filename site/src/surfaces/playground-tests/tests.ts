import { segmentText, diffSegments } from "torph";
import { CASES, ALL_TAGS } from "@torph/test-cases";
import type { Result, TorphApi } from "@torph/test-cases";

// Cases live in `packages/test-cases`, shared with the vitest suite. This only
// binds them to the bundled package.
export const torph: TorphApi = { segmentText, diffSegments };

export type BenchCase = {
  label: string;
  description: string;
  tags: string[];
  values: string[];
  align?: "left" | "center" | "right";
  minLines?: number;
  verify: () => Result;
};

export const TESTS: BenchCase[] = CASES.map((c) => ({
  label: c.label,
  description: c.description,
  tags: c.tags,
  values: c.values,
  align: c.align,
  minLines: c.minLines,
  verify: () => c.verify(torph),
}));

export { ALL_TAGS };
