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
];

function measure(dir, entryList) {
  return entryList.map(({ name, path }) => {
    try {
      const buf = readFileSync(resolve(dir, path));
      return { name, raw: buf.length, gzip: gzipSync(buf).length };
    } catch {
      return { name, raw: 0, gzip: 0 };
    }
  });
}

// Local sizes
const local = measure(dist, entries);

// Published sizes from npm
let published = entries.map(({ name }) => ({ name, raw: 0, gzip: 0 }));
try {
  const tmp = mkdtempSync(resolve(tmpdir(), "torph-npm-"));
  execSync("npm pack torph --pack-destination .", { cwd: tmp, stdio: "pipe" });
  execSync("tar -xzf *.tgz", { cwd: tmp, stdio: "pipe" });
  published = measure(resolve(tmp, "package/dist"), entries);
  rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  console.warn("Could not fetch published package from npm:", e.message);
}

const sizes = local.map((l, i) => {
  const p = published[i];
  return {
    name: l.name,
    raw: l.raw,
    gzip: l.gzip,
    publishedRaw: p.raw,
    publishedGzip: p.gzip,
  };
});

const out = resolve(
  __dirname,
  "../site/src/surfaces/playground/bundle-sizes.json",
);
writeFileSync(out, JSON.stringify(sizes, null, 2) + "\n");
console.log("Wrote bundle sizes:", sizes);
