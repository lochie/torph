export type Segment = {
  id: string;
  string: string;
};

export type DiffResult = {
  segments: Segment[];
  splits: Map<string, Segment[]>;
};

/**
 * The slice of torph a case needs to check its text matching, passed in rather
 * than imported.
 *
 * The cases run against two different builds: vitest resolves them from
 * `packages/torph/src`, the playground from the bundled package. Injecting the
 * functions is what lets one definition cover both — and keeps this package
 * dependency-free, so it can't form a cycle with `torph` itself.
 */
export type TorphApi = {
  segmentText: (
    value: string,
    locale: Intl.LocalesArgument,
  ) => Segment[];
  diffSegments: (
    oldSegments: Segment[],
    newText: string,
    locale: Intl.LocalesArgument,
  ) => DiffResult;
};

export type Result = {
  pass: boolean;
  detail: string;
};

export type TestCase = {
  label: string;
  description: string;
  tags: string[];
  /** The values the playground cycles through, in order. */
  values: string[];
  align?: "left" | "center" | "right";
  /**
   * Minimum visual lines the rendered result should occupy. Checked by the
   * playground only — it needs real layout.
   */
  minLines?: number;
  /** Text-matching assertions. Pure, so both the playground and vitest run it. */
  verify: (t: TorphApi) => Result;
};
