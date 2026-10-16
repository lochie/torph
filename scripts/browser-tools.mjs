import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const output = path.join(root, "benchmarks");
export const cache = path.join(output, ".cache");
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });

/** Build either the working tree or an immutable Git revision with identical settings. */
export async function buildBundle(ref) {
  const result = await build({
    stdin: {
      contents:
        'export * from "./src/index"; export { lcsIndices } from "./src/lib/utils/lcs";',
      resolveDir: path.join(root, "packages/torph"),
      loader: "ts",
    },
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "Torph",
    target: "es2022",
    write: false,
    plugins: ref
      ? [
          {
            name: "baseline-source",
            setup(builder) {
              builder.onLoad({ filter: /\.ts$/ }, ({ path: source }) => ({
                contents: git(
                  "show",
                  `${ref}:${path.relative(root, source).split(path.sep).join("/")}`,
                ),
                loader: "ts",
              }));
            },
          },
        ]
      : [],
  });
  return result.outputFiles[0].text;
}

export function launchBrowser() {
  return chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
  });
}
