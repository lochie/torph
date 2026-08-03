import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { gzipSync } from "zlib";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "../packages/torph/dist");

const entries = [
  { name: "core", path: "index.mjs" },
  { name: "react", path: "react/index.mjs" },
  { name: "vue", path: "vue/index.mjs" },
  { name: "svelte", path: "svelte/index.mjs" },
];

// `null` for an entry that isn't there, so a missing size never reads as zero.
function measure(dir) {
  return entries.map(({ name, path }) => {
    try {
      const buf = readFileSync(resolve(dir, path));
      return { name, raw: buf.length, gzip: gzipSync(buf).length };
    } catch {
      return { name, raw: null, gzip: null };
    }
  });
}

function measurePublished() {
  const tmp = mkdtempSync(resolve(tmpdir(), "torph-npm-"));
  try {
    execSync("npm pack torph --pack-destination .", { cwd: tmp, stdio: "pipe" });
    execSync("tar -xzf *.tgz", { cwd: tmp, stdio: "pipe" });
    return measure(resolve(tmp, "package/dist"));
  } catch (e) {
    console.warn(
      "Could not fetch published package from npm, comparison omitted:",
      e.message,
    );
    return entries.map(({ name }) => ({ name, raw: null, gzip: null }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const local = measure(dist);
const published = measurePublished();

const sizes = local
  .filter((l) => l.gzip !== null)
  .map((l) => {
    const p = published.find((entry) => entry.name === l.name);
    return {
      name: l.name,
      raw: l.raw,
      gzip: l.gzip,
      publishedRaw: p?.raw ?? null,
      publishedGzip: p?.gzip ?? null,
    };
  });

const out = resolve(
  __dirname,
  "../site/src/surfaces/playground/bundle-sizes.json",
);
writeFileSync(out, JSON.stringify(sizes, null, 2) + "\n");
console.log("Wrote bundle sizes:", sizes);
