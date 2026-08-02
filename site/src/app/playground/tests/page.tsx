import fs from "node:fs";
import path from "node:path";
import { PlaygroundTests } from "@/surfaces/playground-tests";
import { extractCaseSources } from "@/surfaces/playground-tests/case-source";

/**
 * Read on the server so the bench can show each case's real source. The page is
 * static, so this happens once at build time.
 */
function readCaseSources(): Record<string, string> {
  const candidates = [
    path.join(process.cwd(), "..", "packages", "test-cases", "src", "cases.ts"),
    path.join(process.cwd(), "packages", "test-cases", "src", "cases.ts"),
  ];

  for (const file of candidates) {
    try {
      return extractCaseSources(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
  }
  return {};
}

export default function Page() {
  return <PlaygroundTests sources={readCaseSources()} />;
}
