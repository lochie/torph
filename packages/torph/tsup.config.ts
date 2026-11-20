import { defineConfig, type Options } from "tsup";
import type { PluginBuild } from "esbuild";

const aliasCorePlugin = {
  name: "alias-core",
  setup(build: PluginBuild) {
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
    // Plugins: one entry each, so a page ships only the ones it imports
    {
      entry: {
        "plugins/blur/index": "src/plugins/blur/index.ts",
        "plugins/words/index": "src/plugins/words/index.ts",
        "plugins/scramble/index": "src/plugins/scramble/index.ts",
        "plugins/flap/index": "src/plugins/flap/index.ts",
        "plugins/typewriter/index": "src/plugins/typewriter/index.ts",
        "plugins/tokens/index": "src/plugins/tokens/index.ts",
        "plugins/odometer/index": "src/plugins/odometer/index.ts",
        "plugins/wave/index": "src/plugins/wave/index.ts",
        "plugins/caseless/index": "src/plugins/caseless/index.ts",
        "plugins/stack/index": "src/plugins/stack/index.ts",
        "plugins/squash/index": "src/plugins/squash/index.ts",
        "plugins/redline/index": "src/plugins/redline/index.ts",
        "plugins/countup/index": "src/plugins/countup/index.ts",
        "plugins/rows/index": "src/plugins/rows/index.ts",
        "plugins/trend/index": "src/plugins/trend/index.ts",
        "plugins/reveal/index": "src/plugins/reveal/index.ts",
        "plugins/smoke/index": "src/plugins/smoke/index.ts",
        "plugins/glitch/index": "src/plugins/glitch/index.ts",
        "plugins/neon/index": "src/plugins/neon/index.ts",
        "plugins/shatter/index": "src/plugins/shatter/index.ts",
        "plugins/stamp/index": "src/plugins/stamp/index.ts",
        "plugins/roll/index": "src/plugins/roll/index.ts",
        "plugins/lookalike/index": "src/plugins/lookalike/index.ts",
        "plugins/mask/index": "src/plugins/mask/index.ts",
        "plugins/fadeUp/index": "src/plugins/fadeUp/index.ts",
        "plugins/cascade/index": "src/plugins/cascade/index.ts",
        "plugins/ticker/index": "src/plugins/ticker/index.ts",
        "plugins/fadeThrough/index": "src/plugins/fadeThrough/index.ts",
        "plugins/sharedAxis/index": "src/plugins/sharedAxis/index.ts",
        "plugins/slot/index": "src/plugins/slot/index.ts",
        "plugins/dissolve/index": "src/plugins/dissolve/index.ts",
        "plugins/ripple/index": "src/plugins/ripple/index.ts",
      },
      format: ["cjs", "esm"],
      dts: true,
      target: "es2022",
      treeshake: true,
      esbuildPlugins: [aliasCorePlugin],
      minify: !options.watch,
    },
    // Debug: development-only checks, kept out of core
    {
      entry: {
        "debug/index": "src/debug/index.ts",
      },
      format: ["cjs", "esm"],
      dts: true,
      target: "es2022",
      treeshake: true,
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
