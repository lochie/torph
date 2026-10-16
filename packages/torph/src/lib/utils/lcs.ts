/**
 * Longest common subsequence as paired indices. Walked forwards so ties go to the
 * earliest match — backwards, a repeated word flies across the block.
 */
export function lcsIndices(a: string[], b: string[]): [number[], number[]] {
  const m = a.length;
  const n = b.length;
  const ai: number[] = [];
  const bi: number[] = [];
  let prefix = 0;
  while (prefix < m && prefix < n && a[prefix] === b[prefix]) {
    ai.push(prefix);
    bi.push(prefix++);
  }
  if (prefix === m || prefix === n) return [ai, bi];

  const columns = n - prefix + 1;
  const dp = new Uint32Array((m - prefix + 1) * columns);

  for (let i = m - 1; i >= prefix; i--) {
    const row = (i - prefix) * columns;
    const next = row + columns;
    for (let j = n - 1; j >= prefix; j--) {
      const column = j - prefix;
      dp[row + column] =
        a[i] === b[j]
          ? dp[next + column + 1]! + 1
          : Math.max(dp[next + column]!, dp[row + column + 1]!);
    }
  }

  let i = prefix;
  let j = prefix;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ai.push(i);
      bi.push(j);
      i++;
      j++;
    } else if (
      dp[(i - prefix + 1) * columns + j - prefix]! >=
      dp[(i - prefix) * columns + j - prefix + 1]!
    ) {
      i++;
    } else {
      j++;
    }
  }

  return [ai, bi];
}
