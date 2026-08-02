import { segmentText, diffSegments } from "torph";
import { CASES, ALL_TAGS } from "@torph/test-cases";
import type { Result, TorphApi } from "@torph/test-cases";

/**
 * The cases live in `packages/test-cases` so this page and the vitest suite in
 * `packages/torph` run the same definitions. This module only binds them to the
 * bundled package.
 */
export const torph: TorphApi = { segmentText, diffSegments };

export type BenchCase = {
  label: string;
  description: string;
  tags: string[];
  values: string[];
  align?: "left" | "center" | "right";
  verify: () => Result;
};

export const TESTS: BenchCase[] = CASES.map((c) => ({
  label: c.label,
  description: c.description,
  tags: c.tags,
  values: c.values,
  align: c.align,
  verify: () => c.verify(torph),
}));

export { ALL_TAGS };
