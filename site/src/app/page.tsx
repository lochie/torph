import fs from "node:fs";
import path from "node:path";
import { Homepage } from "@/surfaces/homepage";

type BundleSize = { name: string; gzip: number | null };

function readBundleSizes(): BundleSize[] {
  // cwd is the site under pnpm, the root when next runs directly.
  const root = fs.existsSync("packages") ? "." : "..";
  const file = path.join(
    root,
    "site/src/surfaces/playground/bundle-sizes.json",
  );

  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

// Core plus the largest wrapper — the worst case anyone actually installs.
function installSize(sizes: BundleSize[]): string | undefined {
  const core = sizes.find((s) => s.name === "core")?.gzip;
  if (!core) return undefined;

  const wrappers = sizes
    .filter((s) => s.name !== "core")
    .map((s) => s.gzip ?? 0);

  const total = core + Math.max(0, ...wrappers);
  return `${(total / 1000).toFixed(1)} kB gzipped`;
}

export default function Home() {
  return <Homepage size={installSize(readBundleSizes())} />;
}
