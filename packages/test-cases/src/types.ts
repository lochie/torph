export type Segment = {
  id: string;
  string: string;
  kind?: "digit" | "symbol";
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

export type NumberSegment = {
  id: string;
  string: string;
  kind: "digit" | "symbol";
};

// Same injection as `TorphApi` above: vitest passes the source function, the
// playground passes the bundled one.
export type NumberTorphApi = {
  segmentNumber: (
    value: string,
    prevSegments?: NumberSegment[],
    cursorIndex?: number,
    decimalChar?: string,
  ) => NumberSegment[];
};

export type NumberCase = {
  label: string;
  description: string;
  tags: string[];
  /** Rendered through `TextMorph`; numbers are formatted by it, strings are not. */
  values: (string | number)[];
  /**
   * Caret position for each value, switching that step from place matching to
   * cursor matching. `undefined` for a step leaves it on place matching.
   */
  cursors?: (number | undefined)[];
  locale?: string;
  decimals?: number;
  align?: "left" | "center" | "right";
  /** Renders the stage with `font-variant-numeric: tabular-nums`. Playground only — needs real layout. */
  tabular?: boolean;
  verify: (t: NumberTorphApi) => Result;
};
