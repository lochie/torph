import { defineConfig, type Options } from "tsup";

const aliasCorePlugin = {
  name: "alias-core",
  setup(build: any) {
    build.onResolve({ filter: /\.\.\/lib\/text-morph/ }, () => ({
      path: "torph",
      external: true,
    }));
  },
};

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
      target: "es2022",
      treeshake: true,
      external: ["react", "react/jsx-runtime"],
      esbuildPlugins: [aliasCorePlugin],
      minify: !options.watch,
      banner: { js: '"use client";' },
    },
    // Vue
    {
      entry: {
        "vue/index": "src/vue/index.ts",
      },
      format: ["cjs", "esm"],
      dts: true,
      target: "es2022",
      treeshake: true,
      external: ["vue"],
      esbuildPlugins: [aliasCorePlugin],
      minify: !options.watch,
    },
    // Svelte - DTS build (from types.ts only)
    {
      entry: {
        "svelte/index": "src/svelte/types.ts",
      },
      format: ["cjs", "esm"],
      dts: {
        only: true,
      },
      external: ["svelte"],
    },
  ];

  return configs;
});
