import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";
import { emitDts } from "svelte2tsx";

const require = createRequire(import.meta.url);
let primedSvelteTypes = false;

async function rewriteImportPath(file: string, from: string, to: string) {
  try {
    const source = await readFile(file, "utf8");
    const next = source.replaceAll(from, to);
    if (next !== source) {
      await writeFile(file, next);
    }
  } catch {
    // File may not exist for a given format/config pair yet.
  }
}

async function emitSvelteTypes() {
  await emitDts({
    declarationDir: "dist/svelte",
    libRoot: resolve("src/svelte"),
    tsconfig: "tsconfig.json",
    svelteShimsPath: require.resolve("svelte2tsx/svelte-shims-v4.d.ts"),
  });

  // Publish TextMorphProps from the generated Svelte component declaration,
  // so the exported props type stays aligned with the component's inferred props.
  await rewriteImportPath('dist/svelte/index.d.ts', 'from "./types"', 'from "./TextMorph.svelte"');
  await writeFile(
    "dist/svelte/types.d.ts",
    'export type { TextMorphProps } from "./TextMorph.svelte";\n',
  );
}

export default defineConfig((options) => [
  // Core and React - with DTS
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    external: ["react", "react/jsx-runtime"],
    minify: !options.watch,
    publint: !options.watch,
    attw: !options.watch,
    banner: { js: '"use client";' },
    hooks: {
      "build:before": async () => {
        if (primedSvelteTypes) return;
        primedSvelteTypes = true;
        await emitSvelteTypes();
      },
    },
  },
  // Vue - JS build
  {
    entry: {
      "vue/index": "src/vue/index.ts",
    },
    format: ["cjs", "esm"],
    dts: false,
    sourcemap: true,
    target: "es2022",
    external: ["vue", "../lib/text-morph", /\.vue$/],
    minify: !options.watch,
    copy: [
      {
        from: "src/vue/TextMorph.vue",
        to: "dist/vue",
      },
    ],
    hooks: {
      "build:done": async () => {
        await Promise.all([
          rewriteImportPath("dist/vue/index.cjs", "../TextMorph.vue", "./TextMorph.vue"),
          rewriteImportPath("dist/vue/index.mjs", "../TextMorph.vue", "./TextMorph.vue"),
          rewriteImportPath('dist/vue/TextMorph.vue', 'from "../index"', 'from "../index.mjs"'),
        ]);
      },
    },
  },
  // Vue - DTS build (from types.ts only)
  {
    entry: {
      "vue/index": "src/vue/types.ts",
    },
    format: ["esm"],
    dts: {
      only: true,
    },
    external: ["vue", "../lib/text-morph/types"],
  },
  // Svelte - JS build
  {
    entry: {
      "svelte/index": "src/svelte/index.ts",
    },
    unbundle: true,
    format: ["cjs", "esm"],
    dts: false,
    sourcemap: true,
    target: "es2022",
    external: ["svelte", "../lib/text-morph", /\.svelte$/],
    minify: !options.watch,
    copy: [
      {
        from: "src/svelte/TextMorph.svelte",
        to: "dist/svelte",
      },
    ],
    hooks: {
      "build:done": async () => {
        await Promise.all([
          rewriteImportPath("dist/svelte/index.cjs", "../TextMorph.svelte", "./TextMorph.svelte"),
          rewriteImportPath("dist/svelte/index.mjs", "../TextMorph.svelte", "./TextMorph.svelte"),
          rewriteImportPath("dist/svelte/TextMorph.svelte", "from '../index';", "from '../index.mjs';"),
        ]);
        await emitSvelteTypes();
      },
    },
  },
]);
