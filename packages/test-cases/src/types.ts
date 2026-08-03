export type Segment = {
  id: string;
  string: string;
};

export type DiffResult = {
  segments: Segment[];
  splits: Map<string, Segment[]>;
};

// Injected rather than imported so one definition can run against both builds:
// vitest resolves torph from source, the playground from the bundle.
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
  values: string[];
  align?: "left" | "center" | "right";
  /** Checked by the playground only — needs real layout. */
  minLines?: number;
  verify: (t: TorphApi) => Result;
};
