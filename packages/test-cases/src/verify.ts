import type { Result, Segment, TorphApi } from "./types";

const L = "en";

function segOf(segments: Segment[], value: string): Segment | undefined {
  return segments.find((s) => s.string === value);
}

export function verifyWordPersistence(
  t: TorphApi,
  from: string,
  to: string,
  word: string,
): Result {
  const old = t.segmentText(from, L);
  const { segments } = t.diffSegments(old, to, L);
  const oldSeg = segOf(old, word);
  const newSeg = segOf(segments, word);

  if (!oldSeg || !newSeg) {
    return {
      pass: false,
      detail: `"${word}" missing in ${!oldSeg ? "old" : "new"}`,
    };
  }

  const pass = oldSeg.id === newSeg.id;
  return {
    pass,
    detail: pass
      ? `"${word}" ID persists`
      : `"${word}" ID changed: ${oldSeg.id} → ${newSeg.id}`,
  };
}

export function verifyWordAbsent(
  t: TorphApi,
  from: string,
  to: string,
  word: string,
): Result {
  const { segments } = t.diffSegments(t.segmentText(from, L), to, L);
  const found = segOf(segments, word);
  return {
    pass: !found,
    detail: found ? `"${word}" unexpectedly present` : `"${word}" correctly absent`,
  };
}

export function verifyCharMorph(
  t: TorphApi,
  from: string,
  to: string,
  splitWord: string,
): Result {
  const { splits } = t.diffSegments(t.segmentText(from, L), to, L);
  const pass = splits.has(splitWord);
  return {
    pass,
    detail: pass
      ? `"${splitWord}" split into chars`
      : `"${splitWord}" was NOT split`,
  };
}

export function verifyNoMorph(t: TorphApi, from: string, to: string): Result {
  const { splits } = t.diffSegments(t.segmentText(from, L), to, L);
  const pass = splits.size === 0;
  return {
    pass,
    detail: pass
      ? "No char splits (correct)"
      : `Unexpected splits: ${[...splits.keys()].join(", ")}`,
  };
}

export function verifyGraphemeMorph(
  t: TorphApi,
  from: string,
  to: string,
  sharedChars: string[],
): Result {
  const oldChars = t.segmentText(from, L).map((s) => s.string);
  const newChars = t.segmentText(to, L).map((s) => s.string);
  const missing = sharedChars.filter(
    (c) => !oldChars.includes(c) || !newChars.includes(c),
  );
  return {
    pass: missing.length === 0,
    detail: missing.length
      ? `Missing shared chars: [${missing.join(",")}]`
      : `Shared chars [${sharedChars.join(",")}] present in both`,
  };
}

export function verifyCycleStability(
  t: TorphApi,
  a: string,
  b: string,
  word: string,
): Result {
  let prev = t.segmentText(a, L);
  const originalId = segOf(prev, word)?.id;
  if (!originalId) return { pass: false, detail: `"${word}" not found in "${a}"` };

  for (let i = 0; i < 4; i++) {
    const { segments } = t.diffSegments(prev, i % 2 === 0 ? b : a, L);
    const seg = segOf(segments, word);
    if (!seg || seg.id !== originalId) {
      return { pass: false, detail: `"${word}" ID changed at cycle ${i + 1}` };
    }
    prev = segments;
  }

  return { pass: true, detail: `"${word}" ID stable across 4 cycles` };
}

export function renderSegments(segments: Segment[]): string {
  return segments
    .map((s) => s.string)
    .join("")
    .replace(/ /g, " ");
}

export function combineResults(...results: Result[]): Result {
  return {
    pass: results.every((r) => r.pass),
    detail: results.map((r) => r.detail).join("; "),
  };
}
