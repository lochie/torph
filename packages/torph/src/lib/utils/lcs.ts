/**
 * Longest common subsequence, reported as paired indices into `a` and `b`.
 *
 * Built over suffixes and walked *forwards* so ties resolve to the earliest
 * match — a repeated word keeps its element on the first occurrence. Walking
 * backwards resolves them the other way, and the text flies across the block.
 */
export function lcsIndices(a: string[], b: string[]): [number[], number[]] {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = length of the LCS of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const ai: number[] = [];
  const bi: number[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ai.push(i);
      bi.push(j);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }

  return [ai, bi];
}
