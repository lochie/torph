import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const output = path.join(root, "benchmarks");
export const cache = path.join(output, ".cache");
const { build } = createRequire(
  new URL("../packages/torph/package.json", import.meta.url),
)("tsup");
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });

/** Build either the working tree or an immutable Git revision with identical settings. */
export async function buildBundle(ref) {
  await mkdir(cache, { recursive: true });
  const entry = path.join(cache, "browser-entry.ts");
  await writeFile(
    entry,
    'export * from "../../packages/torph/src/index"; export { lcsIndices } from "../../packages/torph/src/lib/utils/lcs";',
  );
  const outDir = path.join(cache, ref ? "baseline-build" : "working-build");
  await build({
    entry: { browser: entry },
    outDir,
    outExtension: () => ({ js: ".js" }),
    config: false,
    dts: false,
    silent: true,
    platform: "browser",
    splitting: false,
    minify: true,
    format: ["iife"],
    globalName: "Torph",
    target: "es2022",
    esbuildPlugins: ref
      ? [
          {
            name: "baseline-source",
            setup(builder) {
              builder.onLoad({ filter: /\.ts$/ }, ({ path: source }) => {
                const relative = path
                  .relative(root, source)
                  .split(path.sep)
                  .join("/");
                if (!relative.startsWith("packages/torph/src/")) return;
                return {
                  contents: git("show", `${ref}:${relative}`),
                  loader: "ts",
                };
              });
            },
          },
        ]
      : [],
  });
  return readFile(path.join(outDir, "browser.js"), "utf8");
}

export function launchBrowser() {
  return chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
  });
}
