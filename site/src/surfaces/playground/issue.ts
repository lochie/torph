import type { Result } from "@torph/test-cases";
import { alignment } from "@torph/test-cases";
import pkg from "../../../../packages/torph/package.json";
import { torph } from "./tests";
import type { BenchCase } from "./tests";
import { numberTorph, formatValue } from "./number-tests";
import type { NumberBenchCase } from "./number-tests";
import { decimalSeparator } from "torph";
import { SPEEDS, EASINGS } from "./config";
import type { Speed, EasingKey, Align } from "./config";

function segmentTable(from: string, to: string): string {
  const old = torph.segmentText(from, "en");
  const { segments, splits } = torph.diffSegments(old, to, "en");
  const oldIds = new Set(old.map((s) => s.id));

  const show = (v: string) =>
    v === " " ? "·" : v === "\n" ? "\\n" : v === "​" ? "​(zwsp)" : v;

  const lines = [
    "| | text | id | |",
    "|---|---|---|---|",
    ...old.map((s) => `| old | \`${show(s.string)}\` | \`${s.id}\` | |`),
    ...segments.map(
      (s) =>
        `| new | \`${show(s.string)}\` | \`${s.id}\` | ${
          oldIds.has(s.id) ? "persisted" : "entered"
        } |`,
    ),
  ];

  if (splits.size > 0) {
    lines.push(
      "",
      "Splits: " +
        [...splits.entries()]
          .map(([word, chars]) => `\`${word}\` → ${chars.length} chars`)
          .join(", "),
    );
  }

  return lines.join("\n");
}

export function buildIssueReport({
  test,
  index,
  speed,
  easing,
  align,
  debug,
  result,
  notes,
}: {
  test: BenchCase;
  index: number;
  speed: Speed;
  easing: EasingKey;
  align: Align;
  debug: boolean;
  result: Result | null;
  notes?: string;
}): string {
  const from = test.values[(index - 1 + test.values.length) % test.values.length]!;
  const to = test.values[index]!;
  const ease = EASINGS[easing];

  return [
    `# torph issue — ${test.label}`,
    "",
    notes ? `**What looks wrong:** ${notes}` : "**What looks wrong:** _(describe it)_",
    "",
    `- **torph**: v${pkg.version}`,
    `- **case**: \`${test.label}\` (${test.tags.join(", ")})`,
    `- **description**: ${test.description}`,
    `- **step**: ${index + 1}/${test.values.length}`,
    `- **from** → **to**: ${JSON.stringify(from)} → ${JSON.stringify(to)}`,
    `- **all values**: ${JSON.stringify(test.values)}`,
    `- **duration**: ${SPEEDS[speed]}ms (${speed})`,
    `- **ease**: ${typeof ease === "string" ? ease : JSON.stringify(ease)} (${easing})`,
    `- **align**: ${test.align ?? align}${test.align ? " (fixed by case)" : ""}`,
    `- **debug**: ${debug}`,
    "",
    `## Assertion`,
    result
      ? `${result.pass ? "PASS" : "FAIL"} — ${result.detail}`
      : "not run",
    "",
    `## Segments`,
    segmentTable(from, to),
    "",
    `_Case defined in \`packages/test-cases/src/cases.ts\`._`,
  ].join("\n");
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

// ── Numbers ──

function placeTable(
  from: string,
  to: string,
  cursor: number | undefined,
  decimalChar: string,
): string {
  const places = alignment(numberTorph, from, to, { cursor, decimalChar });

  return [
    "| index | char | came from |",
    "|---|---|---|",
    ...to
      .split("")
      .map(
        (char, i) =>
          `| ${i} | \`${char}\` | ${
            places[i] === null ? "entered" : `index ${places[i]}`
          } |`,
      ),
  ].join("\n");
}

export function buildNumberIssueReport({
  test,
  index,
  speed,
  easing,
  align,
  locale,
  decimals,
  cursor,
  result,
  notes,
}: {
  test: NumberBenchCase;
  index: number;
  speed: Speed;
  easing: EasingKey;
  align: Align;
  locale: string;
  decimals: number | undefined;
  cursor: number | undefined;
  result: Result | null;
  notes?: string;
}): string {
  const prev = (index - 1 + test.values.length) % test.values.length;
  const from = formatValue(test.values[prev]!, locale, decimals);
  const to = formatValue(test.values[index]!, locale, decimals);
  const ease = EASINGS[easing];

  return [
    `# torph issue — ${test.label} (numbers)`,
    "",
    notes
      ? `**What looks wrong:** ${notes}`
      : "**What looks wrong:** _(describe it)_",
    "",
    `- **torph**: v${pkg.version}`,
    `- **case**: \`${test.label}\` (${test.tags.join(", ")})`,
    `- **description**: ${test.description}`,
    `- **step**: ${index + 1}/${test.values.length}`,
    `- **from** → **to**: ${JSON.stringify(from)} → ${JSON.stringify(to)}`,
    `- **all values**: ${JSON.stringify(test.values)}`,
    `- **matching**: ${cursor == null ? "place value" : `cursor at ${cursor}`}`,
    `- **locale**: ${locale} (decimal separator \`${decimalSeparator(locale)}\`)`,
    `- **decimals**: ${decimals ?? "auto"}`,
    `- **duration**: ${SPEEDS[speed]}ms (${speed})`,
    `- **ease**: ${typeof ease === "string" ? ease : JSON.stringify(ease)} (${easing})`,
    `- **align**: ${test.align ?? align}${test.align ? " (fixed by case)" : ""}`,
    "",
    `## Assertion`,
    result ? `${result.pass ? "PASS" : "FAIL"} — ${result.detail}` : "not run",
    "",
    `## Places`,
    placeTable(from, to, cursor, decimalSeparator(locale)),
    "",
    `_Case defined in \`packages/test-cases/src/number-cases.ts\`._`,
  ].join("\n");
}
