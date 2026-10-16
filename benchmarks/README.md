# Torph performance

Baseline: upstream commit `d79a5aa63226acf97d49c3e34fafb2e85c07b026`.
Branch: `swift`. See `results.json` for the browser version, hardware, bundle hashes, operation counts, and every timing sample.

## Results

Median of nine measurements per version, with two discarded warmups per version. Versions alternate order and run in fresh browser pages. Times measure synchronous update work and a final layout flush, excluding animation playback and intentional frame waits.

| Scenario                                  |  Baseline | Optimized | Less processing time |
| ----------------------------------------- | --------: | --------: | -------------------: |
| Mount 60 components                       |  33.50 ms |  19.60 ms |                41.5% |
| Update 60 settled components              | 303.01 ms |  38.49 ms |                87.3% |
| Update 60 components on successive frames | 526.41 ms |  53.91 ms |                89.8% |
| Reorder 180 words, 30 diffs               |  19.00 ms |  18.90 ms |                 0.5% |
| Match 600 tokens, 30 LCS calls            |  52.50 ms |  42.30 ms |                19.4% |

The update rows average eight batches within each measurement. These are workload-specific local results, not a claim about every page or frame rate. The word-reordering result is effectively unchanged. Even the optimized 60-component update exceeds a 16.7 ms frame budget on this machine.

Instrumentation runs separately from timing. Across eight settled update batches, animations fall from 11,520 to 3,360 (70.8% fewer), explicit element removals from 10,480 to 480 (95.4% fewer), and computed-style reads from 53,440 to 44,800 (16.2% fewer). Initial rendering performs zero engine geometry or computed-style reads, compared with 2,800 and 2,680 respectively. The browser still performs its normal layout when the page is displayed.

## What changed

- Initial rendering builds the DOM without running the FLIP measurement and animation setup.
- Reconciliation keeps surviving elements and unchanged text nodes attached, moving elements only when needed.
- Stationary, fully opaque text receives no replacement transform animation.
- Animation state is captured before starting new animations, and each snapshot reads computed style once.
- LCS uses a contiguous typed array and consumes matching prefixes without allocating a matrix for them. Forward tie-breaking remains unchanged.

Public options, animation durations, easing, accessible text, numeric slots, and interrupted motion are preserved. Container width and height animation remains part of Torph's existing layout behavior.

## Repeat the checks

From the repository root, with Node and pnpm 9.10.0 available:

```sh
pnpm install --frozen-lockfile
pnpm benchmark --capture-baseline d79a5aa63226acf97d49c3e34fafb2e85c07b026
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:browser
pnpm benchmark --check
```

The baseline is compiled directly from Git, so capturing it does not replace working-tree files. Both versions use the same bundler settings. Cached bundles stay in the ignored `benchmarks/.cache/` directory; reports are saved in this directory. `--check` fails if any of the three DOM workloads improves by less than 25%. Close unrelated workloads before measuring.

Browser scripts default to installed Microsoft Edge. To use installed Chrome in PowerShell:

```powershell
$env:BROWSER_CHANNEL = "chrome"
pnpm benchmark --check
```

`BENCH_SAMPLES` controls the number of measurements (default 9, minimum 3). Playwright and esbuild are pinned development dependencies; the published library still has no runtime dependencies.

## Correctness

290 unit and integration tests pass, including operation-budget regressions and LCS comparison with exhaustive subsequences over 400 deterministic generated pairs. The library typecheck and build pass. Library lint has no errors or warnings; site lint has eight existing warnings.

`browser-regressions.json` records eleven differential browser cases: tag replacement, labels, word splitting, grouped replacements, multiple lines, empty values, caret updates, center/right alignment, transformed ancestors, and author-defined CSS width. They compare initial and interrupted animation geometry and opacity within 0.05 px, and verify text, live-ID uniqueness, accessible text, exit cleanup, and teardown. The recorded maximum difference is zero in every case. This is automated geometry verification in Edge; Safari, Firefox, and device-level frame profiling have not been run.

## Local preview

Run the library watcher and the docs server in separate terminals:

```sh
pnpm watch
```

```sh
pnpm site:dev
```

- Demo: <http://localhost:3000>
- Playground: <http://localhost:3000/playground>
- Examples: <http://localhost:3000/examples>
