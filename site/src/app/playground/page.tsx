import fs from "node:fs";
import path from "node:path";
import { Playground } from "@/surfaces/playground";
import { extractCaseSources } from "@/surfaces/playground/case-source";

function read(file: string): string | null {
  // cwd is the site through the workspace, the repo root when next runs directly
  const root = fs.existsSync("packages") ? "." : "..";
  const full = path.join(root, file);

  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

export default function Page() {
  const cases = read("packages/test-cases/src/cases.ts");
  // Written by `scripts/bundle-sizes.mjs` and gitignored, so it may not exist
  const sizes = read("site/src/surfaces/playground/bundle-sizes.json");

  return (
    <Playground
      sources={cases ? extractCaseSources(cases) : {}}
      bundleSizes={sizes ? JSON.parse(sizes) : []}
    />
  );
}
