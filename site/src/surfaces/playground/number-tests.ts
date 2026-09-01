import { segmentNumber } from "torph";
import { NUMBER_CASES, ALL_NUMBER_TAGS } from "@torph/test-cases";
import type { NumberCase, NumberTorphApi, Result } from "@torph/test-cases";

// Cases live in `packages/test-cases`, shared with the vitest suite. This only
// binds them to the bundled package.
export const numberTorph: NumberTorphApi = { segmentNumber };

export type NumberBenchCase = Omit<NumberCase, "verify"> & {
  verify: () => Result;
};

export const NUMBER_TESTS: NumberBenchCase[] = NUMBER_CASES.map((testCase) => ({
  ...testCase,
  verify: () => testCase.verify(numberTorph),
}));

export { ALL_NUMBER_TAGS };

/** What `TextMorph` will render for a numeric value — numbers are formatted, strings are not. */
export function formatValue(
  value: string | number,
  locale: string,
  decimals?: number,
): string {
  return typeof value === "number"
    ? value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value;
}
