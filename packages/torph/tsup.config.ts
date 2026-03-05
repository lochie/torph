import { defineConfig, type Options } from "tsup";

export default defineConfig((options) => {
  const configs: Options[] = [
    // Core
    {
      entry: {
        index: "src/index.ts",
      },
      format: ["cjs", "esm"],
      dts: true,
      clean: true,
      sourcemap: true,
      target: "es2022",
      treeshake: true,
      minify: !options.watch,
    },
    // React
    {
      entry: {
        "react/index": "src/react/index.ts",
      },
      format: ["cjs", "esm"],
      dts: true,
      sourcemap: true,
      target: "es2022",
      treeshake: true,
      external: ["react", "react/jsx-runtime"],
      minify: !options.watch,
      banner: { js: '"use client";' },
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
      treeshake: true,
      external: ["vue", "../lib/text-morph"],
      minify: !options.watch,
      loader: {
        ".vue": "copy",
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
      format: ["cjs", "esm"],
      dts: false,
      sourcemap: true,
      target: "es2022",
      treeshake: true,
      external: ["svelte", "../lib/text-morph"],
      minify: !options.watch,
      loader: {
        ".svelte": "copy",
      },
    },
    // Svelte - DTS build (from types.ts only)
    {
      entry: {
        "svelte/index": "src/svelte/types.ts",
      },
      format: ["esm"],
      dts: {
        only: true,
      },
      external: ["svelte", "../lib/text-morph/types"],
    },
  ];

  return configs;
});
