import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distSvelte = resolve(root, "dist/svelte");

mkdirSync(distSvelte, { recursive: true });

// Copy .svelte source to dist, rewriting relative imports to 'torph'
let svelte = readFileSync(resolve(root, "src/svelte/TextMorph.svelte"), "utf8");
svelte = svelte
  .replace(`from '../lib/text-morph'`, `from 'torph'`)
  .replace(`from '../lib/text-morph/controller'`, `from 'torph'`);
writeFileSync(resolve(distSvelte, "TextMorph.svelte"), svelte);

// Create JS entry files that re-export from the .svelte file
const entry = `export { default as TextMorph } from "./TextMorph.svelte";\n`;
writeFileSync(resolve(distSvelte, "index.mjs"), entry);
writeFileSync(resolve(distSvelte, "index.js"), entry);
