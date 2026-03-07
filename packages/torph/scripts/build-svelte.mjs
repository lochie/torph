import { copyFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distSvelte = resolve(root, "dist/svelte");

mkdirSync(distSvelte, { recursive: true });

// Copy the raw .svelte source to dist (imports already use 'torph')
copyFileSync(
  resolve(root, "src/svelte/TextMorph.svelte"),
  resolve(distSvelte, "TextMorph.svelte")
);

// Create JS entry files that re-export from the .svelte file
const entry = `export { default as TextMorph } from "./TextMorph.svelte";\n`;
writeFileSync(resolve(distSvelte, "index.mjs"), entry);
writeFileSync(resolve(distSvelte, "index.js"), entry);
