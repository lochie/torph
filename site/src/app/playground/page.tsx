import fs from "node:fs";
import path from "node:path";
import { Playground } from "@/surfaces/playground";

// Written by `scripts/bundle-sizes.mjs` and gitignored, so it may not exist.
// cwd is the site through the workspace, the repo root when next runs directly.
function readBundleSizes() {
  const root = fs.existsSync("packages") ? "." : "..";
  const file = path.join(
    root,
    "site/src/surfaces/playground/bundle-sizes.json",
  );

  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

export default function Page() {
  return <Playground bundleSizes={readBundleSizes()} />;
}
