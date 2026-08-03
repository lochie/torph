import fs from "node:fs";
import path from "node:path";
import { Playground } from "@/surfaces/playground";
import { extractCaseSources } from "@/surfaces/playground/case-source";

// Resolved against the cwd, which is the site when run through the workspace
// and the repo root when run directly.
function readCasesFile(): string {
  const candidates = [
    path.join(process.cwd(), "..", "packages/test-cases/src/cases.ts"),
    path.join(process.cwd(), "packages/test-cases/src/cases.ts"),
  ];

  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error(`cases.ts not found: tried ${candidates.join(", ")}`);

  return fs.readFileSync(file, "utf8");
}

export default function Page() {
  return <Playground sources={extractCaseSources(readCasesFile())} />;
}
