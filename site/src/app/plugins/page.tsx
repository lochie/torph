import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Plugins, type PluginName } from "@/surfaces/plugins";

export const metadata: Metadata = {
  title: "Plugins • Torph",
  description:
    "Plugins change how torph cuts text up and how it moves: blur, words, scramble, flap, typewriter, tokens, odometer, wave, wipe, caseless, anagram, stack, squash, redline, countup, skeleton, magnet and weight, each with its source.",
};

const NAMES: PluginName[] = [
  "blur",
  "words",
  "scramble",
  "flap",
  "typewriter",
  "tokens",
  "odometer",
  "wave",
  "wipe",
  "caseless",
  "anagram",
  "stack",
  "squash",
  "redline",
  "countup",
  "skeleton",
  "magnet",
  "weight",
];

// Read from the package, so the source on the page is the source that ships.
function readSource(name: PluginName): string {
  // cwd is the site under pnpm, the root when next runs directly.
  const root = fs.existsSync("packages") ? "." : "..";
  const file = path.join(root, `packages/torph/src/plugins/${name}/index.ts`);
  return fs
    .readFileSync(file, "utf8")
    .replace('"../../lib/text-morph/plugin"', '"torph"');
}

export default function Page() {
  const sources = Object.fromEntries(
    NAMES.map((name) => [name, readSource(name)]),
  ) as Record<PluginName, string>;
  return <Plugins sources={sources} />;
}
